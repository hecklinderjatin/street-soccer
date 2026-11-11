import { freeKickChallenge } from './challenge';
import { challengeRoundLevel } from '../shared/freeKickChallenge';
import { pixelLabel } from './ui/pixelLabel';
import { FREE_KICK as FK } from '../shared/tuning';
import { startEarlyDownloads } from './earlyAssets';

startEarlyDownloads();
const host = document.getElementById('freekick');
const loader = document.getElementById('boot-loading');
if (loader) loader.style.display = 'none';
if (host) {
  const config = freeKickChallenge();
  const setup = document.createElement('form');
  setup.className = 'freekick-practice-setup';
  setup.innerHTML = `<div class="practice-panel"><span class="practice-mode">FREE KICK</span><h1>PRACTICE</h1><p>Train with this Challenge's kits, shot-distance range and wall. Unlimited attempts; your chosen level stays fixed.</p><div class="practice-settings"><div><small>SHOT DISTANCE</small><strong class="practice-distance"></strong></div><div><small>WALL FROM GOAL</small><strong class="practice-wall"></strong></div></div><p class="practice-kits"></p><label for="practice-level">CHOOSE LEVEL</label><select id="practice-level" name="level"></select><button class="casual-button" type="submit">START PRACTICE</button><p class="practice-hint">Same spot after every attempt. Pause > New Spot changes the angle. No leaderboard submissions.</p><p role="status"></p></div>`;
  for (const [selector, value] of [
    ['.practice-distance', `${config.distanceM} M`],
    ['.practice-wall', `${config.wallFromGoalM} M`],
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
  const select = setup.querySelector('select');
  const button = setup.querySelector('button');
  for (let level = 1; level <= FK.maxLevel; level++)
    select?.add(new Option(`LEVEL ${level}`, String(level)));
  if (select) select.value = String(challengeRoundLevel(config.difficulty, 0));
  setup.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!button || button.disabled) return;
    button.disabled = true;
    if (loader) loader.style.display = '';
    const level = Number(select?.value ?? 1);
    void import('./freekick/game')
      .then(({ createFreeKickGame }) => {
        setup.remove();
        createFreeKickGame(true, level);
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
