# Cuts the rendered segments into the trailer (dev only, never shipped).
# Usage: python edit.py <plan.json>
#
# plan.json:
# {
#   "title": "STREET SOCCER",
#   "end": ["PLAY FREE ON REDDIT", "R/STREETSOCCERGAME"],
#   "cuts": [
#     {"segment": "dribble1", "start": 0, "frames": 30},
#     {"card": "title", "frames": 30, "background": "dribble1"},
#     {"segment": "goal", "start": 40, "frames": 200, "freeze": [62, 9]},
#     {"card": "end", "frames": 60, "background": "goal"}
#   ]
# }
# Each cut takes `frames` output frames from a rendered segment
# (out/frames/<segment>/) starting at `start`; `freeze: [frame, n]` holds
# that segment frame n extra frames. Cards are drawn in the game's pixel
# font over a darkened frame. Sound is rebuilt from each segment's event
# log: kicks, saves, goals, plus the music and the whistles.
import json
import os
import re
import shutil
import subprocess
import sys

from PIL import Image, ImageEnhance, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, 'out')
FRAMES = os.path.join(OUT, 'frames')
FINAL = os.path.join(OUT, 'final')
AUDIO = os.path.join(ROOT, 'public-release', 'audio')
FPS = 30
W, H = 1280, 720
YELLOW = (255, 236, 39)
WHITE = (255, 241, 232)
BLACK = (0, 0, 0)

src = open(os.path.join(ROOT, 'src', 'client', 'ui', 'glyphs.ts'), encoding='utf8').read()
GLYPHS = {m.group(1): m.group(2).split(' ') for m in re.finditer(r"^  '(.)': '([.# ]+)',", src, re.M)}


def text_width(text, px):
    return (len(text) * 6 - 1) * px


def draw_text(img, text, cx, cy, px, color):
    x0 = round(cx - text_width(text, px) / 2)
    y0 = round(cy - 7 * px / 2)
    ink = Image.new('RGBA', img.size, (0, 0, 0, 0))
    pix = ink.load()
    for offset, col in ((px // 2 or 1, BLACK), (0, color)):
        for i, ch in enumerate(text):
            for gy, row in enumerate(GLYPHS.get(ch, [])):
                for gx, cell in enumerate(row):
                    if cell != '#':
                        continue
                    for dy in range(px):
                        for dx in range(px):
                            x = x0 + (i * 6 + gx) * px + dx + offset
                            y = y0 + gy * px + dy + offset
                            if 0 <= x < W and 0 <= y < H:
                                pix[x, y] = col + (255,)
    img.alpha_composite(ink)


RED = (255, 0, 77)
BLUE = (41, 173, 255)


def cover_score(img):
    # The AI teams are unevenly matched, so the running score looks like a
    # blowout; the scoreboard box shows the teams instead (same box style).
    from PIL import ImageDraw
    rgba = img.convert('RGBA')
    box = Image.new('RGBA', rgba.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(box)
    d.rectangle([16, 16, 352, 72], fill=(17, 17, 26, 255))
    d.rectangle([24, 28, 36, 58], fill=RED)
    d.rectangle([332, 28, 344, 58], fill=BLUE)
    rgba.alpha_composite(box)
    draw_text(rgba, 'RED VS BLUE', 184, 44, 4, WHITE)
    return rgba.convert('RGB')


HUD_BOXES = [(16, 16, 352, 72), (560, 16, 720, 72)]  # score and clock panels


def ease(t):
    return t * t * (3 - 2 * t)


def zoomed(img, z, cx, cy):
    # Push in on (cx, cy) by z; the score and clock panels stay unscaled.
    if z <= 1.001:
        return img
    w, h = W / z, H / z
    x0 = min(max(cx - w / 2, 0), W - w)
    # Keep the window below the HUD strip so the panels aren't scaled too.
    y0 = min(max(cy - h / 2, min(80, H - h)), H - h)
    out = img.resize((W, H), Image.LANCZOS, box=(x0, y0, x0 + w, y0 + h))
    for box in HUD_BOXES:
        out.paste(img.crop(box), box[:2])
    return out


def flashed(img, a):
    return Image.blend(img, Image.new('RGB', img.size, (255, 255, 255)), a) if a > 0 else img


def tagged(img, text):
    rgba = img.convert('RGBA')
    from PIL import ImageDraw
    d = ImageDraw.Draw(rgba)
    x = W - 24 - text_width(text, 4) - 30
    d.rectangle([x - 12, 16, W - 16, 72], fill=(17, 17, 26, 255))
    d.ellipse([x, 34, x + 18, 52], fill=RED)
    draw_text(rgba, text, x + 30 + text_width(text, 4) / 2, 44, 4, WHITE)
    return rgba.convert('RGB')


def card_frames(kind, plan, frames, background):
    bg = Image.open(background).convert('RGBA')
    bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(6))).enhance(0.45)
    out = []
    for i in range(frames):
        img = bg.copy()
        # Punch in: the lettering lands big over the first 6 frames.
        land = min(1, (i + 1) / 6)
        if kind == 'title':
            px = round(16 + (1 - land) * 10)
            draw_text(img, plan['title'], W / 2, H / 2, px, YELLOW)
        else:
            lines = plan['end']
            draw_text(img, lines[0], W / 2, H / 2 - 50, round(9 + (1 - land) * 6), WHITE)
            if len(lines) > 1 and i >= 6:
                draw_text(img, lines[1], W / 2, H / 2 + 50, 7, YELLOW)
        frame = img.convert('RGB')
        if kind == 'title' and i < 4:
            frame = flashed(frame, 0.8 * (1 - i / 4))
        out.append(frame)
    return out


def seg_frame(name, i):
    return os.path.join(FRAMES, name, f'{i:05d}.png')


def main(plan_path):
    plan = json.load(open(plan_path))
    shutil.rmtree(FINAL, ignore_errors=True)
    os.makedirs(FINAL)
    n = 0
    sounds = []  # (output frame, file, volume)

    def put(path_or_img, cut=None, k=0):
        nonlocal n
        dst = os.path.join(FINAL, f'{n:05d}.png')
        if not isinstance(path_or_img, str):
            path_or_img.save(dst)
            n += 1
            return
        img = Image.open(path_or_img).convert('RGB')
        if plan.get('coverScore'):
            img = cover_score(img)
        if cut is not None:
            t = k / max(1, cut['frames'] - 1)
            if 'zoom' in cut:
                z0, z1, cx, cy, *rest = cut['zoom']
                # zoom over the first part of the cut (rest[0], 0..1), then hold
                span = rest[0] if rest else 1
                z = z0 + (z1 - z0) * ease(min(1, t / span))
                img = zoomed(img, z, cx, cy)
            if 'tag' in cut:
                img = tagged(img, cut['tag'])
            flash = cut.get('flash', 0)
            if flash and k < flash:
                img = flashed(img, 0.85 * (1 - k / flash))
            if 'flashAt' in cut:
                at, length = cut['flashAt']
                if 0 <= k - at < length:
                    img = flashed(img, 0.7 * (1 - (k - at) / length))
        img.save(dst)
        n += 1

    for cut in plan['cuts']:
        if 'card' in cut:
            bg_seg = cut['background']
            frames = sorted(f for f in os.listdir(os.path.join(FRAMES, bg_seg)) if f.endswith('.png'))
            bg = os.path.join(FRAMES, bg_seg, frames[cut.get('backgroundFrame', len(frames) // 2)])
            if cut['card'] == 'title':
                sounds.append((n, 'start.mp3', 0.9))
            else:
                sounds.append((n, 'stop.mp3', 0.9))
            for img in card_frames(cut['card'], plan, cut['frames'], bg):
                put(img)
            continue
        name = cut['segment']
        start = cut.get('start', 0)
        freeze_at, freeze_n = cut.get('freeze', [-1, 0])
        events = json.load(open(os.path.join(FRAMES, name, 'events.json')))
        slow = cut.get('slow', False)
        i = start
        written = 0
        while written < cut['frames']:
            out_before = n
            for e in events:
                if e['out'] != i:
                    continue
                if e['type'] == 'kick':
                    sounds.append((out_before, 'shoot.mp3', 0.55 if slow else 0.8))
                elif e['type'] == 'shotEnd' and e.get('save'):
                    sounds.append((out_before, 'goal-miss.mp3', 0.9))
                elif e['type'] == 'goal':
                    sounds.append((out_before, 'goal.mp3', 1.0))
            put(seg_frame(name, i), cut, written)
            written += 1
            if i == freeze_at:
                for _ in range(freeze_n):
                    if written >= cut['frames']:
                        break
                    put(seg_frame(name, i), cut, written)
                    written += 1
            i += 1

    total = n / FPS
    print(f'{n} frames, {total:.2f} s, {len(sounds)} sounds')

    # Soundtrack: music under everything, effects on their frames.
    # ffmpeg input 0 is the frames, 1 the music, 2.. the effects.
    inputs = ['-i', os.path.join(AUDIO, 'bgm.mp3')]
    filters = [f'[1:a]volume={plan.get("music", 0.55)},atrim=0:{total},afade=t=out:st={total - 1.2}:d=1.2[m]']
    mix = ['[m]']
    for k, (frame, file, vol) in enumerate(sounds, start=2):
        inputs += ['-i', os.path.join(AUDIO, file)]
        ms = round(frame * 1000 / FPS)
        filters.append(f'[{k}:a]volume={vol},adelay={ms}|{ms}[s{k}]')
        mix.append(f'[s{k}]')
    filters.append(f'{"".join(mix)}amix=inputs={len(mix)}:normalize=0,atrim=0:{total}[a]')
    video = os.path.join(OUT, plan.get('output', 'street-soccer-trailer.mp4'))
    cmd = [
        'ffmpeg', '-y', '-loglevel', 'error',
        '-framerate', str(FPS), '-i', os.path.join(FINAL, '%05d.png'),
        *inputs,
        '-filter_complex', ';'.join(filters),
        '-map', '0:v', '-map', '[a]',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
        '-t', f'{total}', video,
    ]
    subprocess.run(cmd, check=True)
    print(video, f'{os.path.getsize(video) / 1e6:.1f} MB')


main(sys.argv[1])
