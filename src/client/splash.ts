import { context, requestExpandedMode } from '@devvit/web/client';

const startButton = document.getElementById(
  'start-button'
) as HTMLButtonElement;

startButton.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

const greetingElement = document.getElementById(
  'greeting'
) as HTMLParagraphElement;

// context is only populated inside Reddit; a local preview has none.
const username = context?.username;
if (username) {
  greetingElement.textContent = `Hey u/${username}, 90-second 5v5 street football. Can you beat the AI?`;
}
