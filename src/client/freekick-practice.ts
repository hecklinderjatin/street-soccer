import { FREE_KICK as FK } from '../shared/tuning';
import { startEarlyDownloads } from './earlyAssets';

startEarlyDownloads();
const host = document.getElementById('freekick');
const loader = document.getElementById('boot-loading');
if (loader) loader.style.display = 'none';
if (host) {
  const setup = document.createElement('form');
  setup.className = 'freekick-practice-setup';
  setup.innerHTML = `<h1>FREE KICK PRACTICE</h1><p>Unlimited attempts at your chosen level. Your normal best score stays unchanged.</p><label for="practice-level">CHOOSE LEVEL</label><select id="practice-level" name="level"></select><button type="submit">START PRACTICE</button><p role="status"></p>`;
  const select = setup.querySelector('select');
  const button = setup.querySelector('button');
  for (let level = 1; level <= FK.maxLevel; level++)
    select?.add(new Option(`LEVEL ${level}`, String(level)));
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
