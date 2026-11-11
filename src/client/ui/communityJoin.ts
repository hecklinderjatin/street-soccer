import { canRunAsUser, context } from '@devvit/web/client';
import { casualButton } from './casualScreen';
import { pixelLabel } from './pixelLabel';

// Optional results action, never an interstitial or a membership requirement.
// The SDK cannot read prior membership; honor confirmed joins/skip preferences.
export function communityJoin(results: HTMLElement, portrait = false) {
  const key =
    context?.userId && context?.subredditId
      ? `street-soccer:joined:${context.userId}:${context.subredditId}`
      : null;
  let known = false;
  try {
    known =
      !!key &&
      (localStorage.getItem(key) === 'yes' ||
        localStorage.getItem(`${key}:self-confirmed`) === 'yes');
  } catch {
    /* Optional device storage. */
  }
  if (!context?.postId || !context.subredditName || known)
    return { destroy() {} };
  const root = document.createElement('section');
  root.className = `results-community${portrait ? ' is-portrait' : ''}`;
  root.setAttribute('aria-label', 'Join the community');
  const copy = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = 'Enjoyed the match?';
  const description = document.createElement('p');
  description.textContent = `Join r/${context.subredditName} for new challenges and game updates.`;
  copy.append(title, description);
  const note = document.createElement('p');
  note.className = 'results-community-note';
  note.textContent =
    'Optional. Reddit will ask for permission. Joining won’t post anything on your behalf.';
  const status = document.createElement('p');
  status.className = 'results-community-status';
  status.setAttribute('role', 'status');
  let pending = false,
    disposed = false;
  const join = casualButton(
    'JOIN COMMUNITY',
    (event) => {
      void subscribe(event);
    },
    true
  );
  async function subscribe(event: MouseEvent) {
    if (pending || disposed) return;
    if (!context.userId) {
      status.textContent = 'Log in to Reddit to join this community.';
      return;
    }
    pending = true;
    join.disabled = true;
    pixelLabel(join, 'JOINING...');
    status.textContent = 'Waiting for Reddit permission…';
    try {
      if (!(await canRunAsUser(event)))
        throw new Error(
          'Joining was not approved. You can still continue playing.'
        );
      if (disposed) return;
      status.textContent = 'Joining the community…';
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
            : `Could not join (HTTP ${response.status}). You can join from the subreddit page.`;
        throw new Error(
          `${typeof detail === 'string' ? detail.slice(0, 240) : fallback}${typeof reference === 'string' ? ' Ref: ' + reference.slice(0, 36) : ''}`
        );
      }
      if (
        !payload ||
        typeof payload !== 'object' ||
        Reflect.get(payload, 'joined') !== true
      )
        throw new Error(
          'Join confirmation was not received. You can join from the subreddit page.'
        );
      try {
        if (key) localStorage.setItem(key, 'yes');
      } catch {
        /* Joining still succeeded. */
      }
      if (!disposed) {
        join.hidden = true;
        title.textContent = 'Welcome to the community!';
        description.textContent = `r/${context.subredditName}`;
        note.hidden = true;
        status.textContent = 'Thanks for joining! Welcome to the street.';
        status.classList.add('is-success');
      }
    } catch (error) {
      if (!disposed)
        status.textContent =
          error instanceof Error
            ? error.message
            : 'Could not join. You can still continue playing.';
    } finally {
      pending = false;
      if (!disposed) {
        join.disabled = false;
        pixelLabel(join, 'JOIN COMMUNITY');
      }
    }
  }
  root.append(copy, join, note, status);
  const actions = results.querySelector('.results-actions');
  if (actions?.parentElement) actions.before(root);
  else (results.querySelector('.results-panel') ?? results).append(root);
  return {
    destroy() {
      disposed = true;
      root.remove();
    },
  };
}
