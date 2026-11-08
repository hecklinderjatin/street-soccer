import { context, requestExpandedMode } from '@devvit/web/client';
import { pixelLabel } from '../ui/pixelLabel';
import { measurePlay } from '../playMetrics';
import { FREE_KICK as FK } from '../../shared/tuning';

export function showFreeKickLobby() {
  const host = document.getElementById('game');
  if (!host) return;
  host.classList.add('freekick-post');
  const card = document.createElement('section');
  card.className = 'freekick-lobby';
  card.innerHTML = `
    <header>STREET SOCCER <span>FREE KICK</span></header>
    <div class="freekick-preview" aria-hidden="true"><div class="freekick-net"></div><img src="/ball.svg" alt=""></div>
    <div class="freekick-lobby-details">
      <h1>BEAT THE WALL.<br>FIND THE CORNER.</h1>
      <p class="freekick-description"></p>
      <a class="freekick-play" href="freekick.html">PLAY</a>
      <p>${FK.lives} lives. Build your score as the challenge gets tougher.</p>
      <a class="freekick-practice" href="freekick-practice.html">PRACTICE</a>
      <p>Choose a level. Unlimited retries. No best-score changes.</p>
    </div>`;
  const description = card.querySelector('.freekick-description');
  const data: unknown = context?.postData;
  const value =
    data && typeof data === 'object' ? Reflect.get(data, 'description') : '';
  if (description)
    description.textContent = typeof value === 'string' ? value : '';
  for (const [selector, text, entry] of [
    ['.freekick-play', 'PLAY', 'freekick'],
    ['.freekick-practice', 'PRACTICE', 'freekick-practice'],
  ]) {
    const button = card.querySelector<HTMLAnchorElement>(selector ?? '');
    if (!button || !text || !entry) continue;
    pixelLabel(button, text);
    button.addEventListener('click', (event) => {
      if (entry === 'freekick') measurePlay('play_tap', 'freekick');
      if (!context?.postId) return;
      event.preventDefault();
      requestExpandedMode(event, entry);
    });
  }
  host.replaceChildren(card);
}
