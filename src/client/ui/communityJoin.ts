import { canRunAsUser, context, navigateTo } from '@devvit/web/client';
import { casualButton } from './casualScreen';
import { pixelLabel } from './pixelLabel';

// A recent join is a reminder cooldown, not proof of current membership.
const JOIN_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const CONSENT_TIMEOUT_MS = 30000;
const FAILURE =
  'Couldn’t join right now. Please try again or open the community.';

export function communityJoin(results: HTMLElement) {
  const key =
    context?.userId && context?.subredditId
      ? `street-soccer:joined-at:${context.userId}:${context.subredditId}`
      : null;
  let recent = false;
  try {
    const joinedAt = Number(key && localStorage.getItem(key));
    const age = Date.now() - joinedAt;
    recent = joinedAt > 0 && age >= 0 && age < JOIN_COOLDOWN_MS;
  } catch {
    /* Optional device storage. */
  }
  if (!context?.postId || !context.subredditName || recent)
    return { destroy() {} };
  const actions = results.querySelector('.results-actions');
  if (!actions) return { destroy() {} };
  let pending = false,
    disposed = false;
  let active: AbortController | undefined;
  const status = document.createElement('p');
  status.className = 'community-join-status';
  status.setAttribute('role', 'status');
  const note = document.createElement('p');
  note.className = 'community-join-note';
  note.textContent =
    'Optional. Reddit may ask for joining and posting permissions. Joining won’t post anything. You can keep playing without joining.';
  const join = casualButton(
    'JOIN',
    (event) => void subscribe(event),
    true
  );
  join.classList.add('community-join-button');

  const dialog = document.createElement('dialog');
  dialog.className = 'community-join-dialog';
  dialog.setAttribute('aria-label', 'Join community');
  const heading = document.createElement('h2');
  pixelLabel(heading, 'JOIN');
  const message = document.createElement('p');
  message.textContent = FAILURE;
  const controls = document.createElement('div');
  controls.className = 'community-join-dialog-actions';
  const close = () => {
    dialog.close();
    if (!disposed) join.focus({ preventScroll: true });
  };
  const retry = casualButton('TRY AGAIN', (event) => {
    close();
    void subscribe(event);
  });
  const open = casualButton(
    'OPEN COMMUNITY',
    () => {
      try {
        navigateTo(
          `https://www.reddit.com/r/${encodeURIComponent(context.subredditName ?? '')}/`
        );
        close();
      } catch {
        message.textContent = FAILURE;
      }
    },
    true
  );
  const dismiss = casualButton('CLOSE', close, true);
  controls.append(retry, open, dismiss);
  dialog.append(heading, message, controls);
  document.body.append(dialog);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Tab') {
      if (event.shiftKey && document.activeElement === retry) {
        event.preventDefault();
        dismiss.focus();
      } else if (!event.shiftKey && document.activeElement === dismiss) {
        event.preventDefault();
        retry.focus();
      }
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  const failure = () => {
    if (disposed) return;
    status.textContent = '';
    message.textContent = FAILURE;
    dialog.showModal();
    retry.focus({ preventScroll: true });
  };

  async function subscribe(event: MouseEvent) {
    if (pending || disposed) return;
    if (!context.userId) {
      failure();
      return;
    }
    pending = true;
    // Keep focus while disabling duplicate clicks; restore it if this control hides.
    const restoreFocus = document.activeElement === join;
    join.disabled = true;
    pixelLabel(join, 'JOINING...');
    status.textContent = 'Waiting for Reddit permission…';
    const controller = new AbortController();
    active = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopWaiting: (() => void) | undefined;
    try {
      const cancelled = new Promise<never>((_, reject) => {
        stopWaiting = () => reject(new Error('Join cancelled'));
        controller.signal.addEventListener('abort', stopWaiting, {
          once: true,
        });
      });
      timer = setTimeout(() => controller.abort(), CONSENT_TIMEOUT_MS);
      const allowed = await Promise.race([canRunAsUser(event), cancelled]);
      clearTimeout(timer);
      // A late consent response never starts a subscription after timeout or exit.
      if (!allowed || disposed || controller.signal.aborted)
        throw new Error('Join unavailable');
      status.textContent = 'Joining the community…';
      const response = await fetch('/api/community/join', {
        method: 'POST',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        !payload ||
        typeof payload !== 'object' ||
        Reflect.get(payload, 'joined') !== true
      )
        throw new Error('Join unavailable');
      if (disposed || controller.signal.aborted) return;
      try {
        if (key) localStorage.setItem(key, String(Date.now()));
      } catch {
        /* Optional storage. */
      }
      const focused = document.activeElement;
      join.hidden = true;
      note.hidden = true;
      status.textContent = 'Thanks for joining! Welcome to the street.';
      status.classList.add('is-success');
      if (focused === join || (restoreFocus && focused === document.body))
        actions
          ?.querySelector<HTMLButtonElement>(
            'button:not([hidden]):not(:disabled)'
          )
          ?.focus({ preventScroll: true });
    } catch {
      failure();
    } finally {
      clearTimeout(timer);
      if (stopWaiting)
        controller.signal.removeEventListener('abort', stopWaiting);
      active = undefined;
      pending = false;
      if (!disposed) {
        join.disabled = false;
        pixelLabel(join, 'JOIN');
      }
    }
  }
  actions.insertBefore(join, actions.querySelector('.results-retry'));
  actions.after(note, status);
  return {
    destroy() {
      disposed = true;
      active?.abort();
      dialog.close();
      dialog.remove();
      join.remove();
      note.remove();
      status.remove();
    },
  };
}
