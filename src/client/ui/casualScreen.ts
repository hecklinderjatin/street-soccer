import { pixelLabel } from './pixelLabel';

// Native controls keep arrow targets readable in portrait and landscape.
export function casualScreen(title: string, subtitle: string) {
  const element = document.createElement('section');
  element.className = 'casual-screen';
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
  return { element, panel };
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
