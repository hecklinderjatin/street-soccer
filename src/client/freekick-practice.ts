import { freeKickChallenge } from './challenge';
import {
  challengeRoundLevel,
  endlessFreeKick,
} from '../shared/freeKickChallenge';
import { practicePicks } from './freekick/practicePicks';
import { pixelLabel } from './ui/pixelLabel';
import { FREE_KICK as FK } from '../shared/tuning';
import { startEarlyDownloads } from './earlyAssets';

// Practice setup: random spots from the post's settings at a chosen level,
// or (a Challenge post) one of its actual rounds, exactly as it plays.
startEarlyDownloads();
const host = document.getElementById('freekick');
const loader = document.getElementById('boot-loading');
if (loader) loader.style.display = 'none';
if (host) {
  const config = freeKickChallenge();
  const infinity = endlessFreeKick(config);
  const picks = practicePicks(config);
  const rounds = picks.length;
  const setup = document.createElement('form');
  setup.className = 'freekick-practice-setup';
  setup.innerHTML = `<div class="practice-panel"><span class="practice-mode">FREE KICK</span><h1>PRACTICE</h1><p>Train with this post's kits, shot-distance range and wall. Unlimited attempts, unranked.</p><div class="practice-settings"><div><small>SHOT DISTANCE</small><strong class="practice-distance"></strong></div><div><small>WALL FROM BALL</small><strong class="practice-wall"></strong></div></div><p class="practice-kits"></p><label for="practice-round" class="practice-round-label">PRACTISE</label><select id="practice-round" name="round"></select><label for="practice-level" class="practice-level-label">CHOOSE LEVEL</label><select id="practice-level" name="level"></select><button class="casual-button" type="submit">START PRACTICE</button><p class="practice-hint"></p><p role="status"></p></div>`;
  for (const [selector, value] of [
    ['.practice-distance', `${config.distanceM} M`],
    ['.practice-wall', `${config.wallGapM} M`],
    [
      '.practice-kits',
      `KICKER: ${config.kicker.toUpperCase()} / WALL: ${config.wall.toUpperCase()}`,
    ],
  ]) {
    const node = setup.querySelector(selector ?? '');
    if (node) node.textContent = value ?? '';
  }
  for (const selector of ['h1', '.practice-mode', 'button']) {
    const node = setup.querySelector<HTMLElement>(selector);
    if (node) pixelLabel(node, node.textContent ?? '');
  }
  const roundSelect = setup.querySelector<HTMLSelectElement>('#practice-round');
  const levelSelect = setup.querySelector<HTMLSelectElement>('#practice-level');
  const levelLabel = setup.querySelector<HTMLElement>('.practice-level-label');
  const roundLabel = setup.querySelector<HTMLElement>('.practice-round-label');
  const hint = setup.querySelector('.practice-hint');
  const button = setup.querySelector('button');
  roundSelect?.add(new Option('RANDOM SPOTS', ''));
  for (const pick of picks)
    roundSelect?.add(new Option(pick.label, String(pick.round + 1)));
  // (A post with no rounds to pick shows the level picker only.)
  if (!rounds) {
    roundSelect?.remove();
    roundLabel?.remove();
  }
  for (let level = 1; level <= FK.maxLevel; level++)
    levelSelect?.add(new Option(`LEVEL ${level}`, String(level)));
  if (levelSelect)
    levelSelect.value = String(challengeRoundLevel(config.difficulty));
  // A round plays at the Challenge's own level: no level to choose.
  const sync = () => {
    const round = Boolean(roundSelect?.value);
    if (levelSelect) levelSelect.hidden = round;
    if (levelLabel) levelLabel.hidden = round;
    if (hint)
      hint.textContent = round
        ? `The exact ${infinity ? 'Infinity' : 'Challenge'} kick, every attempt. NEXT moves to the next one; SETUP changes it in game. No leaderboard submissions.`
        : 'Same spot after every attempt. NEW SPOT changes the angle; SETUP changes level in game. No leaderboard submissions.';
  };
  roundSelect?.addEventListener('change', sync);
  sync();
  setup.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!button || button.disabled) return;
    button.disabled = true;
    if (loader) loader.style.display = '';
    const level = Number(levelSelect?.value ?? 1);
    const picked = Number(roundSelect?.value || 0);
    const round = picks.some((pick) => pick.round === picked - 1)
      ? picked - 1
      : null;
    void import('./freekick/game')
      .then(({ createFreeKickGame }) => {
        setup.remove();
        createFreeKickGame(true, level, null, round);
      })
      .catch(() => {
        if (loader) loader.style.display = 'none';
        host.append(setup);
        button.disabled = false;
        const status = setup.querySelector('[role="status"]');
        if (status)
          status.textContent = 'Could not load Practice. Please try again.';
      });
  });
  host.append(setup);
}
