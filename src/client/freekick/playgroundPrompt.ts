import { context, requestExpandedMode } from '@devvit/web/client';
import { casualButton } from '../ui/casualScreen';
import { pixelLabel } from '../ui/pixelLabel';
import { playgroundSaves } from './playgroundSaves';

export function showPlaygroundPrompt(returnFocus: HTMLButtonElement) {
  const dialog = document.createElement('dialog');
  dialog.className = 'practice-panel playground-prompt';
  const heading = document.createElement('h1');
  pixelLabel(heading, 'Create Your Own Game');
  heading.id = 'playground-prompt-title';
  dialog.setAttribute('aria-labelledby', heading.id);

  const status = document.createElement('p');
  status.id = 'playground-prompt-status';
  status.setAttribute('role', 'status');
  const create = casualButton('Create Game', (event) =>
    openBuilder(event, 'freekick-playground')
  );
  create.classList.add('playground-create');
  create.autofocus = true;
  const resume = casualButton(
    'Continue Game',
    (event) => {
      if (hasSave) openBuilder(event, 'freekick-playground-continue');
      else void checkSaves();
    },
    true
  );
  resume.setAttribute('aria-describedby', status.id);
  const close = casualButton('Back to Results', () => dismiss(), true);

  let hasSave = false;
  const controller = new AbortController();

  function dismiss(restoreFocus = true) {
    controller.abort();
    dialog.close();
    dialog.remove();
    if (restoreFocus) returnFocus.focus({ preventScroll: true });
  }

  function openBuilder(event: MouseEvent, entry: string) {
    if (context?.postId) {
      requestExpandedMode(event, entry);
    } else {
      const link = document.createElement('a');
      link.href = `${entry}.html`;
      link.click();
    }
    dismiss();
  }

  async function checkSaves() {
    resume.disabled = true;
    status.textContent = 'Checking for a saved game…';
    try {
      const [latest] = await playgroundSaves(
        'saves',
        undefined,
        AbortSignal.any([controller.signal, AbortSignal.timeout(8000)])
      );
      if (controller.signal.aborted) return;
      hasSave = Boolean(latest);
      resume.disabled = !hasSave;
      status.textContent = latest
        ? `Last saved game: ${latest.setup.title || 'Untitled kick'}`
        : 'No saved game yet.';
    } catch {
      if (controller.signal.aborted) return;
      status.textContent =
        'Couldn’t check saves. Select Continue Game to retry.';
      resume.disabled = false;
    }
  }

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dismiss();
  });
  dialog.append(heading, create, resume, status, close);
  document.body.append(dialog);
  dialog.showModal();
  void checkSaves();
  return () => dismiss(false);
}
