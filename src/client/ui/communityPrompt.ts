import { canRunAsUser, context } from '@devvit/web/client';
import { casualButton } from './casualScreen';
import { pixelLabel } from './pixelLabel';

// The SDK cannot read prior Reddit membership. Only remember a successful
// explicit join, scoped to this account and community on this device.
export function communityPrompt(results: HTMLElement, portrait = false) {
  const key =
    context?.userId && context?.subredditId
      ? `street-soccer:joined:${context.userId}:${context.subredditId}`
      : null;
  let known = false;
  try {
    known = !!key && localStorage.getItem(key) === 'yes';
  } catch {
    /* storage may be unavailable */
  }
  if (!context?.postId || !context.subredditName || known)
    return { destroy() {} };
  const root = document.createElement('section');
  root.className = `community-prompt${portrait ? ' is-portrait' : ''}`;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Join the community');
  const panel = document.createElement('div');
  panel.className = 'community-prompt-panel';
  const tag = document.createElement('small');
  pixelLabel(tag, 'MATCH COMPLETE');
  const title = document.createElement('h1');
  pixelLabel(title, 'JOIN THE STREET');
  const name = document.createElement('p');
  name.className = 'community-prompt-name';
  name.textContent = `r/${context.subredditName}`;
  const copy = document.createElement('p');
  copy.textContent =
    'Enjoyed the match? Join for new challenges and game updates.';
  const permissionNote = document.createElement('p');
  permissionNote.className = 'community-permission-note';
  permissionNote.textContent =
    'Reddit will ask for permission. Joining won’t post anything on your behalf. You can decline and continue playing.';
  const status = document.createElement('p');
  status.className = 'community-prompt-status';
  status.setAttribute('role', 'status');
  const actions = document.createElement('div');
  actions.className = 'community-prompt-actions';
  const note = document.createElement('p');
  note.className = 'community-prompt-note';
  note.textContent = 'Joining is optional. Continue to see your match results.';
  let closed = false,
    pending = false,
    disposed = false;
  const previousVisibility = results.style.visibility;
  const previousInert = results.inert;
  results.style.visibility = 'hidden';
  results.inert = true;
  const close = (focus = true) => {
    if (closed) return;
    closed = true;
    root.remove();
    document.removeEventListener('keydown', keyboard);
    results.style.visibility = previousVisibility;
    results.inert = previousInert;
    if (focus) results.querySelector<HTMLElement>('button, a[href]')?.focus();
  };
  const join = casualButton('JOIN COMMUNITY', (event) => {
    void subscribe(event);
  });
  const next = casualButton('CONTINUE TO RESULTS', () => close(), true);
  const retry = casualButton(
    'RETRY JOIN',
    (event) => {
      void subscribe(event);
    },
    true
  );
  retry.classList.add('community-retry');
  retry.hidden = true;
  let resultNote: HTMLParagraphElement | null = null;
  function notifyResults(message: string, success = false) {
    if (disposed) return;
    retry.hidden = true;
    resultNote ??= document.createElement('p');
    resultNote.className = `community-result-note${success ? ' is-success' : ''}`;
    resultNote.setAttribute('role', 'status');
    resultNote.textContent = message;
    (results.querySelector('.results-panel') ?? results).prepend(resultNote);
    results.scrollTop = 0;
  }
  async function subscribe(event: MouseEvent) {
    if (pending || disposed) return;
    if (!context.userId) {
      close();
      notifyResults('Log in to Reddit to join this community.');
      return;
    }
    pending = true;
    join.disabled = true;
    pixelLabel(join, 'JOINING...');
    status.textContent = '';
    try {
      const consent = canRunAsUser(event);
      close();
      notifyResults('Waiting for Reddit permission…');
      if (!(await consent))
        throw new Error('Joining was not approved. You can still continue.');
      if (disposed) return;
      notifyResults('Joining the community…');
      const response = await fetch('/api/community/join', {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail =
          payload && typeof payload === 'object'
            ? Reflect.get(payload, 'error')
            : null;
        const reference =
          payload && typeof payload === 'object'
            ? Reflect.get(payload, 'reference')
            : null;
        const fallback =
          response.status === 404
            ? 'Join is unavailable in this game version. Reopen the updated post.'
            : `Could not join (HTTP ${response.status}). Please retry.`;
        throw new Error(
          `${typeof detail === 'string' ? detail.slice(0, 240) : fallback}${typeof reference === 'string' ? ' Ref: ' + reference.slice(0, 36) : ''}`
        );
      }
      if (
        !payload ||
        typeof payload !== 'object' ||
        Reflect.get(payload, 'joined') !== true
      )
        throw new Error('Join confirmation was not received. Please retry.');
      try {
        if (key) localStorage.setItem(key, 'yes');
      } catch {
        /* Joining still succeeded. */
      }
      notifyResults('Thanks for joining! Welcome to the street.', true);
    } catch (error) {
      close();
      notifyResults(
        error instanceof Error
          ? error.message
          : 'Could not join. You can still continue playing.'
      );
      if (!disposed && resultNote) {
        resultNote.after(retry);
        retry.hidden = false;
      }
    } finally {
      pending = false;
      if (!closed) {
        join.disabled = false;
        pixelLabel(join, 'JOIN COMMUNITY');
      }
    }
  }
  function keyboard(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
    if (event.key === 'Tab') {
      const first = join.disabled ? next : join;
      const target = event.shiftKey ? first : next;
      if (document.activeElement === target) {
        event.preventDefault();
        (event.shiftKey ? next : first).focus();
      }
    }
  }
  actions.append(join, next);
  panel.append(tag, title, name, copy, permissionNote, actions, status, note);
  root.append(panel);
  document.body.append(root);
  document.addEventListener('keydown', keyboard);
  join.focus();
  return {
    destroy() {
      disposed = true;
      resultNote?.remove();
      retry.remove();
      close(false);
    },
  };
}
