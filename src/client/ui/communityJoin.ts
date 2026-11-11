import { canRunAsUser, context } from '@devvit/web/client';
import { casualButton } from './casualScreen';
import { pixelLabel } from './pixelLabel';

// Optional results action, never an interstitial or a membership requirement.
// The SDK cannot read prior membership. Suppress only confirmed in-game joins,
// not an old preference to skip the removed popup.
export function communityJoin(results: HTMLElement) {
  const key =
    context?.userId && context?.subredditId
      ? `street-soccer:joined:${context.userId}:${context.subredditId}`
      : null;
  let known = false;
  try {
    known = !!key && localStorage.getItem(key) === 'yes';
  } catch {
    /* Optional device storage. */
  }
  if (!context?.postId || !context.subredditName || known)
    return { destroy() {} };
  const actions = results.querySelector('.results-actions');
  if (!actions) return { destroy() {} };
  const status = document.createElement('p');
  status.className = 'community-join-status';
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
  join.classList.add('community-join-button');
  join.title =
    'Optional. Reddit will ask for permission. Joining won’t post anything on your behalf.';
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
      if (!response.ok) throw new Error('Join failed');
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
        status.textContent = 'Thanks for joining! Welcome to the street.';
        status.classList.add('is-success');
      }
    } catch {
      // Keep API/SDK errors and diagnostic references out of player-facing copy.
      if (!disposed)
        status.textContent =
          'Couldn’t join right now. You can join from the community page.';
    } finally {
      pending = false;
      if (!disposed) {
        join.disabled = false;
        pixelLabel(join, 'JOIN COMMUNITY');
      }
    }
  }
  actions.insertBefore(join, actions.querySelector('.results-retry'));
  actions.after(status);
  return {
    destroy() {
      disposed = true;
      join.remove();
      status.remove();
    },
  };
}
