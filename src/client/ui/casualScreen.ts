import { pixelLabel } from './pixelLabel';

// Native controls keep arrow targets readable in portrait and landscape.
export function casualScreen(
  title: string,
  subtitle: string,
  setup = false,
  layout: {
    compactBelow?: number;
    minimalBelow?: number;
    fitToViewport?: boolean;
  } = {}
) {
  const element = document.createElement('section');
  element.className = setup ? 'casual-screen is-setup' : 'casual-screen';
  element.setAttribute('aria-label', title);
  const panel = document.createElement('div');
  panel.className = 'casual-panel';
  const heading = document.createElement('h1');
  pixelLabel(heading, title);
  const description = document.createElement('p');
  description.textContent = subtitle;
  description.className = 'casual-subtitle';
  panel.append(heading, description);
  element.append(panel);
  document.body.append(element);
  const resize = () => {
    const viewport = window.visualViewport;
    const height = viewport?.height ?? window.innerHeight;
    element.style.height = `${height}px`;
    element.style.top = `${viewport?.offsetTop ?? 0}px`;
    const style = getComputedStyle(element);
    const available =
      height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    element.dataset.compact = String(available < (layout.compactBelow ?? 530));
    element.dataset.minimal = String(available < (layout.minimalBelow ?? 430));
  };
  // Results can grow after the leaderboard or save status loads.
  const fit = () => {
    const style = getComputedStyle(element);
    const available =
      element.clientHeight -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom);
    panel.style.setProperty(
      '--results-scale',
      String(
        Math.min(1, Math.max(0, available) / Math.max(1, panel.offsetHeight))
      )
    );
  };
  const observer = layout.fitToViewport ? new ResizeObserver(fit) : null;
  observer?.observe(element);
  observer?.observe(panel);
  resize();
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  const destroy = () => {
    window.removeEventListener('resize', resize);
    window.visualViewport?.removeEventListener('resize', resize);
    observer?.disconnect();
    element.remove();
  };
  return { element, panel, heading, description, destroy };
}

export function casualButton(
  label: string,
  onClick: (event: MouseEvent) => void,
  secondary = false
) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = secondary ? 'casual-button secondary' : 'casual-button';
  pixelLabel(button, label);
  button.addEventListener('click', onClick);
  return button;
}
