import { context, exitExpandedMode } from '@devvit/web/client';

export function showLaunchError(error: unknown) {
  console.error('Could not start Street Soccer', error);
  let loader = document.getElementById('boot-loading');
  // Boot may already have scheduled the old loading element's removal.
  if (loader?.classList.contains('done')) {
    loader.remove();
    loader = null;
  }
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'boot-loading';
    document.body.append(loader);
  }

  const panel = document.createElement('section');
  panel.className = 'launch-error';
  panel.setAttribute('aria-labelledby', 'launch-error-title');
  const title = document.createElement('h1');
  title.id = 'launch-error-title';
  title.tabIndex = -1;
  title.textContent = 'Couldn’t load the game';
  const actions = document.createElement('div');
  actions.className = 'launch-error-actions';

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'casual-button';
  retry.textContent = 'Retry';
  // A rejected module import can remain cached for this document.
  retry.addEventListener('click', () => window.history.go(0));
  actions.append(retry);

  if (context?.postId) {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'casual-button secondary';
    back.textContent = 'Back to post';
    back.addEventListener('click', (event) => exitExpandedMode(event));
    actions.append(back);
  } else {
    const back = document.createElement('a');
    back.className = 'casual-button secondary';
    back.href = 'splash.html';
    back.textContent = 'Back to preview';
    actions.append(back);
  }

  panel.append(title, actions);
  loader.classList.remove('done');
  loader.classList.add('has-launch-error');
  loader.replaceChildren(panel);
  title.focus();
}
