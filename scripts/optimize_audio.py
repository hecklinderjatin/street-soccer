"""Write the compressed audio the game ships (public-release/audio) as MP3.

Inputs: the editable sources in public/audio (WAV effects, the music MP3).
Effects become mono 96 kbps MP3 (a few KB each instead of up to 1.8 MB of
24-bit stereo WAV); the background music becomes 64 kbps stereo MP3, which
the game streams. Stale release files are removed.
Needs: pip install lameenc miniaudio
"""

import wave
from pathlib import Path

import lameenc
import miniaudio

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "audio"
TARGET = ROOT / "public-release" / "audio"
TARGET.mkdir(parents=True, exist_ok=True)
EFFECT_KBPS = 96
MUSIC_KBPS = 64


def encode(pcm16: bytes, rate: int, channels: int, kbps: int) -> bytes:
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(kbps)
    encoder.set_in_sample_rate(rate)
    encoder.set_channels(channels)
    encoder.set_quality(2)  # 2 = high quality, slower
    return bytes(encoder.encode(pcm16) + encoder.flush())


def wav_to_mono16(path: Path) -> tuple[bytes, int]:
    """Decode a PCM WAV (16/24/32-bit, any channels) to 16-bit mono."""
    with wave.open(str(path)) as w:
        channels, width, rate = w.getnchannels(), w.getsampwidth(), w.getframerate()
        raw = w.readframes(w.getnframes())
    frame = channels * width
    out = bytearray()
    for i in range(0, len(raw) - frame + 1, frame):
        total = 0
        for c in range(channels):
            s = raw[i + c * width : i + (c + 1) * width]
            total += int.from_bytes(s, "little", signed=width > 1) >> (8 * (width - 2))
        out += max(-32768, min(32767, total // channels)).to_bytes(2, "little", signed=True)
    return bytes(out), rate


written = set()
total_in = total_out = 0
for source in sorted(SOURCE.glob("*.wav")):
    pcm, rate = wav_to_mono16(source)
    output = TARGET / f"{source.stem}.mp3"
    output.write_bytes(encode(pcm, rate, 1, EFFECT_KBPS))
    written.add(output.name)
    total_in += source.stat().st_size
    total_out += output.stat().st_size
    print(f"{source.name} {source.stat().st_size / 1024:.0f} KiB -> {output.name} {output.stat().st_size / 1024:.0f} KiB")

music = SOURCE / "bgm.mp3"
if music.exists():
    decoded = miniaudio.decode_file(str(music), output_format=miniaudio.SampleFormat.SIGNED16)
    output = TARGET / "bgm.mp3"
    output.write_bytes(
        encode(decoded.samples.tobytes(), decoded.sample_rate, decoded.nchannels, MUSIC_KBPS)
    )
    written.add(output.name)
    total_in += music.stat().st_size
    total_out += output.stat().st_size
    print(f"bgm.mp3 {music.stat().st_size / 1024:.0f} KiB -> {output.stat().st_size / 1024:.0f} KiB ({decoded.duration:.0f} s)")

for stale in TARGET.iterdir():
    if stale.is_file() and stale.name not in written:
        stale.unlink()
        print(f"removed {stale.name}")
print(f"audio: {total_in / 1048576:.2f} -> {total_out / 1048576:.2f} MiB")
