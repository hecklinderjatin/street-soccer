import { context, exitExpandedMode, navigateTo } from '@devvit/web/client';
import { startEarlyDownloads } from './earlyAssets';
import { freeKickChallenge } from './challenge';
import { pixelLabel } from './ui/pixelLabel';
import { JERSEY_SWATCH } from './ui/palette';
import { FREE_KICK as FK } from '../shared/tuning';
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  JERSEY_COLORS,
  type JerseyColor,
} from '../shared/types';
import {
  CUSTOM_KICK_DEFAULT,
  customMaxAngle,
  customMaxWallGap,
  parseCustomSetup,
  parseCustomTitle,
  type CustomKick,
  type CustomSetup,
} from '../shared/freeKickCustom';
import type { PlaygroundSave } from '../shared/api';
import { PlaygroundLink } from './freekick/playgroundLink';

// The Free Kick Playground (user request, 2026-11-11): build one kick on
// the live game view, test it, then name it, pick kits and save it or
// share it to the community as its own post (one life, ranked as usual).
// The settings sheet slides up over the bottom of the view; each group
// opens from its tile, ranges step with arrows, switches are checkboxes.

startEarlyDownloads();

const post = freeKickChallenge();
let kick: CustomKick =
  post.mode === 'custom' && post.custom
    ? { ...post.custom }
    : { ...CUSTOM_KICK_DEFAULT };
let kicker: JerseyColor = post.kicker;
let wallKit: JerseyColor = post.wall;
let title = '';
let slot: number | null = null; // the save slot this kick came from or went to
let scored = false; // the current kick has been scored at least once
let sheetUp = true;
let openTile: string | null = null; // the setup window open over the menu
const link = new PlaygroundLink(kick);
// Desktop (wide landscape): the settings dock on the right of the game,
// all open at once (playground.css moves the game column left for them).
const dockQuery = window.matchMedia(
  '(min-width: 600px) and (min-height: 480px) and (min-aspect-ratio: 1/1)'
);
let docked = dockQuery.matches;
document.documentElement.classList.add('is-playground');

const host = document.getElementById('freekick');
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = ''
) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) pixelLabel(node, text);
  return node;
};
const hex = (color: JerseyColor) =>
  `#${JERSEY_SWATCH[color].toString(16).padStart(6, '0')}`;
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

// Keeps a kick inside the limits for its own distance and wall size.
function fit(next: CustomKick): CustomKick {
  const [nearest, furthest] = FK.customDistanceM;
  const distanceM = clamp(next.distanceM, nearest, furthest);
  const maxAngle = customMaxAngle(distanceM);
  const [fewest, most] = FK.customWallMen;
  const wallMen = clamp(next.wallMen, fewest, most);
  return {
    ...next,
    distanceM,
    angleDeg: clamp(next.angleDeg, -maxAngle, maxAngle),
    wallGapM: clamp(
      next.wallGapM,
      FK.customWallGapM[0],
      customMaxWallGap(distanceM)
    ),
    wallShift: clamp(next.wallShift, -FK.customShiftSteps, FK.customShiftSteps),
    wallMen,
    lyer: next.lyer && wallMen >= 3,
  };
}

const side = (n: number, left: string, right: string, zero: string) =>
  n === 0 ? zero : `${Math.abs(n)} ${n > 0 ? left : right}`;
const angleText = (k: CustomKick) =>
  k.angleDeg === 0
    ? 'CENTRE'
    : `${Math.abs(k.angleDeg)} DEG ${k.angleDeg > 0 ? 'LEFT' : 'RIGHT'}`;
const summary = (k: CustomKick) =>
  `${k.distanceM} M / ${angleText(k)} / ${k.wallMen}-MAN WALL / ${DIFFICULTY_LABEL[k.difficulty]}`;

// ---- Building blocks --------------------------------------------------------

const renders: (() => void)[] = [];
function render() {
  for (const update of renders) update();
  afterRender();
}

function setKick(next: CustomKick) {
  const fitted = fit(next);
  if (JSON.stringify(fitted) === JSON.stringify(kick)) return;
  kick = fitted;
  scored = false; // a changed kick has to be scored again before sharing
  link.update({ kick });
  render();
}

// Hold an arrow to keep stepping.
function holdToRepeat(button: HTMLButtonElement, act: () => void) {
  let timer: number | undefined;
  const stop = () => {
    window.clearTimeout(timer);
    timer = undefined;
  };
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    act();
    const again = (delay: number) => {
      timer = window.setTimeout(() => {
        act();
        again(90);
      }, delay);
    };
    again(400);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel'])
    button.addEventListener(type, stop);
  // Keyboard: Enter / Space step once.
  button.addEventListener('click', (event) => {
    if (event.detail === 0) act();
  });
}

function arrow(dir: 'left' | 'right', label: string, act: () => void) {
  const button = el('button', `pg-arrow pg-arrow-${dir}`);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  holdToRepeat(button, act);
  return button;
}

// LABEL  <  VALUE  >
function stepper(
  label: string,
  value: () => string,
  step: (dir: -1 | 1) => void,
  swatch?: () => string
) {
  const row = el('div', 'pg-row');
  const name = el('span', 'pg-row-label', label);
  const out = el('output', 'pg-value');
  const chip = swatch ? el('span', 'pg-swatch') : null;
  row.append(
    name,
    arrow('left', `${label}: previous`, () => step(-1)),
    out,
    arrow('right', `${label}: next`, () => step(1))
  );
  renders.push(() => {
    pixelLabel(out, value());
    // The kit's colour sits inside the value box, before its name.
    if (chip && swatch) {
      chip.style.background = swatch();
      out.prepend(chip);
    }
  });
  return row;
}

function checkbox(
  label: string,
  checked: () => boolean,
  set: (on: boolean) => void,
  note?: () => string
) {
  const row = el('label', 'pg-check');
  const input = el('input');
  input.type = 'checkbox';
  const box = el('span', 'pg-box');
  box.setAttribute('aria-hidden', 'true');
  const text = el('span', 'pg-check-label', label);
  const hint = el('small', 'pg-check-note');
  const words = el('span', 'pg-check-text');
  words.append(text, hint);
  row.append(input, box, words);
  input.addEventListener('change', () => set(input.checked));
  renders.push(() => {
    input.checked = checked();
    hint.textContent = note?.() ?? '';
  });
  return row;
}

// A closed tile in the sheet's menu; it opens its own window in place of
// the menu (DONE closes it), so the sheet never scrolls.
function tile(
  id: string,
  name: string,
  sum: () => string,
  rows: Node[],
  menu: HTMLElement,
  windows: HTMLElement
) {
  const head = el('button', 'pg-tile-head');
  head.type = 'button';
  const value = el('span', 'pg-tile-sum');
  head.append(
    el('span', 'pg-tile-name', name),
    value,
    el('span', 'pg-chevron')
  );
  const win = el('div', 'pg-window');
  win.id = `pg-${id}`;
  win.setAttribute('role', 'group');
  win.setAttribute('aria-label', name);
  head.setAttribute('aria-controls', win.id);
  const bar = el('div', 'pg-window-bar');
  const done = button('DONE', 'secondary pg-mini', () => {
    openTile = null;
    render();
    head.focus({ preventScroll: true });
  });
  bar.append(el('span', 'pg-tile-name', name), done);
  const body = el('div', 'pg-window-body');
  body.append(...rows);
  win.append(bar, body);
  head.addEventListener('click', () => {
    openTile = id;
    render();
    done.focus({ preventScroll: true });
  });
  menu.append(head);
  windows.append(win);
  renders.push(() => {
    // Docked (desktop): every window shows at once, no menu or DONE.
    win.hidden = !docked && openTile !== id;
    done.hidden = docked;
    head.setAttribute('aria-expanded', String(docked || openTile === id));
    pixelLabel(value, sum());
  });
}

function button(
  text: string,
  className: string,
  act: (event: MouseEvent) => void
) {
  const node = el('button', `casual-button ${className}`, text);
  node.type = 'button';
  node.addEventListener('click', act);
  return node;
}

// ---- Setup sheet ------------------------------------------------------------

function buildSheet(root: HTMLElement) {
  const sheet = el('section', 'pg-sheet');
  sheet.setAttribute('aria-label', 'Free kick setup');
  const head = el('header', 'pg-head');
  const grip = el('button', 'pg-grip');
  grip.type = 'button';
  grip.setAttribute('aria-label', 'Hide or show the setup');
  const gripTitle = el('span', 'pg-grip-title', 'PLAYGROUND  1/2 SETUP');
  grip.append(el('span', 'pg-grip-bar'), gripTitle);
  grip.addEventListener('click', () => {
    if (!docked) slide(!sheetUp);
  });
  head.append(
    grip,
    button('SAVED', 'secondary pg-mini', () => void showSaves()),
    button('EXIT', 'secondary pg-mini', leave)
  );

  const body = el('div', 'pg-body');
  const menu = el('div', 'pg-menu');
  body.append(menu);
  const checks = el('div', 'pg-checks');
  checks.append(
    checkbox(
      'WALL JUMPS',
      () => kick.jump,
      (on) => setKick({ ...kick, jump: on })
    ),
    checkbox(
      'LYING BEHIND',
      () => kick.lyer,
      (on) => {
        if (on && kick.wallMen < 3) {
          setStatus('A lying player needs 3 or more in the wall.');
          render();
          return;
        }
        setKick({ ...kick, lyer: on });
      },
      () => (kick.wallMen < 3 ? 'needs 3+ men' : '')
    )
  );
  const groups: [string, string, () => string, Node[]][] = [
    ['shot', 'SHOT POSITION', () => `${kick.distanceM} M / ${angleText(kick)}`, [
      stepper(
        'DISTANCE',
        () => `${kick.distanceM} M`,
        (d) => setKick({ ...kick, distanceM: kick.distanceM + d })
      ),
      stepper(
        'ANGLE',
        () => angleText(kick),
        // The left arrow moves the spot left.
        (d) => setKick({ ...kick, angleDeg: kick.angleDeg - d })
      ),
    ]],
    [
      'wall',
      'WALL SETTING',
      () => `${kick.wallMen} MEN / ${kick.wallGapM} M`,
      [
        stepper(
          'FROM BALL',
          () => `${kick.wallGapM} M`,
          (d) => setKick({ ...kick, wallGapM: kick.wallGapM + d })
        ),
        stepper(
          'SIDEWAYS',
          () => side(kick.wallShift, 'RIGHT', 'LEFT', 'NEAR POST'),
          (d) => setKick({ ...kick, wallShift: kick.wallShift + d })
        ),
        stepper(
          'PLAYERS',
          () => String(kick.wallMen),
          (d) => setKick({ ...kick, wallMen: kick.wallMen + d })
        ),
        checks,
      ],
    ],
    ['difficulty', 'DIFFICULTY', () => DIFFICULTY_LABEL[kick.difficulty], [
      stepper(
        'KEEPER',
        () => DIFFICULTY_LABEL[kick.difficulty],
        (d) => {
          const i = DIFFICULTIES.indexOf(kick.difficulty) + d;
          const next = DIFFICULTIES[clamp(i, 0, DIFFICULTIES.length - 1)];
          if (next) setKick({ ...kick, difficulty: next });
        }
      ),
    ]],
  ];
  for (const [id, name, sum, rows] of groups)
    tile(id, name, sum, rows, menu, body);
  renders.push(() => {
    menu.hidden = docked || openTile !== null;
  });

  const status = el('p', 'pg-status');
  status.setAttribute('role', 'status');
  const foot = el('footer', 'pg-foot');
  const test = button('TEST SHOT', 'pg-test', () => slide(false));
  foot.append(test, button('NEXT', 'pg-next', showKits));
  // Docked, the kick is always playable: the panel says whether it has
  // been scored yet in place of TEST SHOT.
  const dockTested = el('p', 'pg-tested pg-dock-tested');
  sheet.append(head, body, status, dockTested, foot);

  // Shown while testing (sheet down): back to the setup, or on to share.
  const float = el('div', 'pg-float');
  const tested = el('span', 'pg-tested');
  float.append(
    button('EDIT', 'secondary', () => slide(true)),
    button('NEXT', 'pg-next', showKits),
    tested
  );
  renders.push(() => {
    sheet.classList.toggle('is-down', !docked && !sheetUp);
    sheet.classList.toggle('is-docked', docked);
    float.hidden = docked || sheetUp;
    test.hidden = docked;
    dockTested.hidden = !docked;
    grip.setAttribute('aria-expanded', String(docked || sheetUp));
    const line = scored
      ? 'SCORED: READY TO SHARE'
      : docked
        ? 'SHOOT ON THE PITCH: SCORE ONCE TO SHARE'
        : 'SCORE ONCE TO SHARE';
    for (const node of [tested, dockTested]) {
      pixelLabel(node, line);
      node.classList.toggle('is-scored', scored);
    }
  });
  root.append(sheet, float);

  let statusTimer: number | undefined;
  setStatus = (text: string) => {
    status.textContent = text;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => (status.textContent = ''), 3500);
  };

  // The camera frames the kick into the part of the view above the sheet.
  // The sheet fits its content, so it changes height as windows open.
  // Docked beside the game (desktop), the panel covers none of it: the
  // whole view frames the kick and it can be taken at any time.
  const reframe = () => {
    const height = root.clientHeight || 1;
    const editing = !docked && sheetUp;
    const viewRatio = editing ? 1 - sheet.offsetHeight / height : 1;
    if (editing === link.editing && Math.abs(viewRatio - link.viewRatio) < 0.005)
      return;
    link.update({ editing, viewRatio });
  };
  dockQuery.addEventListener('change', (event) => {
    docked = event.matches;
    render();
  });
  slide = (up: boolean) => {
    sheetUp = up;
    render();
  };
  afterRender = () => window.requestAnimationFrame(reframe);
  window.addEventListener('resize', reframe);
  reframe();
}
let setStatus: (text: string) => void = () => {};
let afterRender: () => void = () => {};
let slide: (up: boolean) => void = () => {};

function leave(event: MouseEvent) {
  if (context?.postId) exitExpandedMode(event);
  else navigateTo('splash.html');
}

// ---- Kits and title -----------------------------------------------------------

function showKits() {
  if (!host) return;
  const screen = el('div', 'pg-screen');
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');
  const panel = el('div', 'practice-panel pg-panel');
  const rows: (() => void)[] = [];
  const cycle = (color: JerseyColor, other: JerseyColor, d: -1 | 1) => {
    const n = JERSEY_COLORS.length;
    let i = JERSEY_COLORS.indexOf(color);
    do i = (i + d + n) % n;
    while (JERSEY_COLORS[i] === other);
    return JERSEY_COLORS[i] ?? color;
  };
  const kitRow = (
    label: string,
    get: () => JerseyColor,
    set: (c: JerseyColor) => void,
    other: () => JerseyColor
  ) => {
    const before = renders.length;
    const row = stepper(
      label,
      () => get().toUpperCase(),
      (d) => {
        set(cycle(get(), other(), d));
        paint();
      },
      () => hex(get())
    );
    // Kit rows belong to this screen only.
    rows.push(...renders.splice(before));
    return row;
  };
  const titleLabel = el('label', 'pg-title-field');
  const titleText = el('span', 'pg-row-label', 'TITLE');
  const input = el('input');
  input.maxLength = FK.customTitleMax;
  input.placeholder = 'Curl it round the wall';
  input.value = title;
  input.addEventListener('input', () => (title = input.value));
  titleLabel.append(titleText, input);
  const facts = el('p', 'pg-facts');
  facts.textContent = summary(kick);
  const status = el('p', 'pg-status');
  status.setAttribute('role', 'status');
  const say = (text: string) => (status.textContent = text);
  const actions = el('div', 'pg-actions');
  const share = button('SHARE TO SUB', 'pg-share', () => void doShare());
  actions.append(
    button('BACK', 'secondary', close),
    button('SAVE', 'secondary', () => void doSave()),
    share
  );
  panel.append(
    el('span', 'practice-mode', 'PLAYGROUND 2/2'),
    el('h1', '', 'KITS AND TITLE'),
    kitRow(
      'KICKER KIT',
      () => kicker,
      (c) => (kicker = c),
      () => wallKit
    ),
    kitRow(
      'WALL KIT',
      () => wallKit,
      (c) => (wallKit = c),
      () => kicker
    ),
    titleLabel,
    facts,
    status,
    actions
  );
  screen.append(panel);
  document.body.append(screen); // over the whole page (and the docked panel)
  function paint() {
    for (const update of rows) update();
  }
  paint();
  input.focus({ preventScroll: true });
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  function close() {
    document.removeEventListener('keydown', onKey);
    screen.remove();
  }
  const setup = (): CustomSetup => ({ kick, kicker, wall: wallKit, title });
  async function doSave() {
    say('Saving...');
    try {
      // At most FK.customSaveSlots saved kicks: a new one needs a free slot
      // (re-saving a loaded kick overwrites its own slot).
      const existing = await request('saves');
      const own = existing.some((s) => s.slot === slot);
      if (!own && existing.length >= FK.customSaveSlots) {
        say('');
        showAlert(
          'SAVES FULL',
          `You can keep ${FK.customSaveSlots} saved kicks. Delete one in SAVED to make room.`,
          [
            [
              'OPEN SAVED',
              'pg-test',
              () => {
                close();
                void showSaves();
              },
            ],
            ['OK', 'secondary', () => undefined],
          ]
        );
        return;
      }
      if (!own) slot = null;
      const saved = await api('/api/playground/save', { setup: setup(), slot });
      const at: unknown =
        saved && typeof saved === 'object' ? Reflect.get(saved, 'slot') : null;
      const list: unknown =
        saved && typeof saved === 'object' ? Reflect.get(saved, 'saves') : null;
      if (typeof at === 'number') slot = at;
      say(
        `Saved (${Array.isArray(list) ? list.length : '?'}/${FK.customSaveSlots}). Load it from SAVED.`
      );
    } catch (error) {
      say(message(error));
    }
  }
  async function doShare() {
    if (!scored) {
      showAlert(
        'SCORE IT FIRST',
        'Prove your kick can be beaten: take a test shot and score it once, then share it.',
        [
          [
            'TEST SHOT',
            'pg-test',
            () => {
              close();
              slide(false);
            },
          ],
          ['NOT NOW', 'secondary', () => undefined],
        ]
      );
      return;
    }
    if (parseCustomTitle(title) === null) {
      say(`Give it a title (3 to ${FK.customTitleMax} characters).`);
      input.focus();
      return;
    }
    share.disabled = true;
    say('Posting your kick...');
    try {
      const response = await api('/api/playground/share', { setup: setup() });
      const url: unknown =
        response && typeof response === 'object'
          ? Reflect.get(response, 'url')
          : undefined;
      if (typeof url !== 'string') throw new Error('Could not share. Please retry.');
      say('Shared! Opening your post...');
      navigateTo(url);
    } catch (error) {
      // Daily limit, cooldown or a failed post: an alert, not a status line.
      say('');
      showAlert("COULDN'T SHARE", message(error), [
        ['OK', 'secondary', () => undefined],
      ]);
    } finally {
      share.disabled = false;
    }
  }
}

// A game-styled alert over everything: a heading, a line and its buttons
// (each closes the alert, then does its action).
function showAlert(
  heading: string,
  text: string,
  actions: [string, string, () => void][]
) {
  if (!host) return;
  const shade = el('div', 'pg-alert-shade');
  const box = el('div', 'pg-alert');
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  const title = el('h2', 'pg-alert-title', heading);
  title.id = 'pg-alert-title';
  box.setAttribute('aria-labelledby', title.id);
  const line = el('p', 'pg-alert-text');
  line.textContent = text;
  const row = el('div', 'pg-alert-actions');
  const close = () => {
    document.removeEventListener('keydown', onKey, { capture: true });
    shade.remove();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.stopImmediatePropagation();
    close();
  };
  for (const [label, className, act] of actions)
    row.append(
      button(label, className, () => {
        close();
        act();
      })
    );
  box.append(el('span', 'pg-alert-icon', '!'), title, line, row);
  shade.append(box);
  document.body.append(shade);
  document.addEventListener('keydown', onKey, { capture: true });
  row.querySelector('button')?.focus({ preventScroll: true });
}

// ---- Saved kicks --------------------------------------------------------------

async function showSaves() {
  if (!host) return;
  const screen = el('div', 'pg-screen');
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');
  const panel = el('div', 'practice-panel pg-panel');
  const list = el('div', 'pg-saves');
  const status = el('p', 'pg-status');
  status.setAttribute('role', 'status');
  status.textContent = 'Loading your saved kicks...';
  const close = () => screen.remove();
  panel.append(
    el('span', 'practice-mode', 'PLAYGROUND'),
    el('h1', '', 'SAVED KICKS'),
    list,
    status,
    button('CLOSE', 'secondary', close)
  );
  screen.append(panel);
  document.body.append(screen); // over the whole page (and the docked panel)
  const show = (saves: PlaygroundSave[]) => {
    list.replaceChildren();
    status.textContent = saves.length
      ? `${saves.length}/${FK.customSaveSlots} slots used.`
      : 'Nothing saved yet. Build a kick, then NEXT > SAVE.';
    for (const save of saves) {
      const row = el('div', 'pg-save');
      const name = el('strong');
      name.textContent = save.setup.title || 'Untitled kick';
      const facts = el('small');
      facts.textContent = summary(save.setup.kick);
      const text = el('div');
      text.append(name, facts);
      row.append(
        text,
        button('LOAD', '', () => {
          slot = save.slot;
          kicker = save.setup.kicker;
          wallKit = save.setup.wall;
          title = save.setup.title;
          setKick(save.setup.kick);
          close();
          slide(true);
        }),
        button('DELETE', 'secondary', () => {
          status.textContent = 'Deleting...';
          void request('delete', { slot: save.slot })
            .then((next) => {
              if (slot === save.slot) slot = null;
              show(next);
            })
            .catch((error: unknown) => (status.textContent = message(error)));
        })
      );
      list.append(row);
    }
  };
  try {
    show(await request('saves'));
  } catch (error) {
    status.textContent = message(error);
  }
}

// ---- Server -------------------------------------------------------------------

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please retry.';

async function api(path: string, body?: object): Promise<unknown> {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error: unknown =
      data && typeof data === 'object' ? Reflect.get(data, 'error') : null;
    throw new Error(
      typeof error === 'string' ? error : 'Playground unavailable. Please retry.'
    );
  }
  return data;
}

// The player's saved kicks, after a list, save or delete.
async function request(
  action: 'saves' | 'save' | 'delete',
  body?: object
): Promise<PlaygroundSave[]> {
  const data = await api(`/api/playground/${action}`, body);
  const raw: unknown =
    data && typeof data === 'object' ? Reflect.get(data, 'saves') : null;
  if (!Array.isArray(raw)) return [];
  const saves: PlaygroundSave[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const setup = parseCustomSetup(Reflect.get(item, 'setup'), true);
    const at: unknown = Reflect.get(item, 'slot');
    const savedAt: unknown = Reflect.get(item, 'savedAt');
    if (
      typeof setup !== 'string' &&
      typeof at === 'number' &&
      typeof savedAt === 'number'
    )
      saves.push({ slot: at, setup, savedAt });
  }
  return saves;
}

// ---- Start --------------------------------------------------------------------

if (host) {
  const loader = document.getElementById('boot-loading');
  link.onGoal = () => {
    if (scored) return;
    scored = true;
    render();
  };
  link.onReady = () => {
    buildSheet(host);
    render();
  };
  void import('./freekick/game')
    .then(({ createFreeKickGame }) => createFreeKickGame(true, 1, link))
    .catch(() => {
      if (loader)
        loader.textContent = 'Couldn’t load the Playground. Please reopen the post.';
    });
}
