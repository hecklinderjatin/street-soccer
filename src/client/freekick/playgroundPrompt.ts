import { context, requestExpandedMode } from '@devvit/web/client';
import { casualButton } from '../ui/casualScreen';
import { pixelLabel } from '../ui/pixelLabel';

export function showPlaygroundPrompt(returnFocus: HTMLButtonElement) {
  const dialog = document.createElement('dialog');
  dialog.className = 'practice-panel playground-prompt';
  const heading = document.createElement('h1');
  pixelLabel(heading, 'Create Your Own Game');
  heading.id = 'playground-prompt-title';
  dialog.setAttribute('aria-labelledby', heading.id);

  const create = casualButton('Create Game', openBuilder);
  create.classList.add('playground-create');
  create.autofocus = true;
  const resume = casualButton('Continue Game', () => dismiss(), true);

  function dismiss(restoreFocus = true) {
    dialog.close();
    dialog.remove();
    if (restoreFocus) returnFocus.focus({ preventScroll: true });
  }

  function openBuilder(event: MouseEvent) {
    const entry = 'freekick-playground';
    if (context?.postId) {
      requestExpandedMode(event, entry);
    } else {
      const link = document.createElement('a');
      link.href = `${entry}.html`;
      link.click();
    }
    dismiss();
  }

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dismiss();
  });
  dialog.append(heading, create, resume);
  document.body.append(dialog);
  dialog.showModal();
  return () => dismiss(false);
}
