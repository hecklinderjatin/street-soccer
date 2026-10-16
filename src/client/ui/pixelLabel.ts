import { GLYPHS } from './glyphs';

// Reuse the game's 5x7 lettering in native-size lobby controls. The hidden
// text keeps buttons accessible; SVG pixels inherit the surrounding UI colour.
export function pixelLabel(element: HTMLElement, text: string) {
  const value = text.toUpperCase().replaceAll('–', '-');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const width = Math.max(1, value.length * 6 - 1);
  svg.setAttribute('viewBox', `0 0 ${width} 7`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'lobby-pixel');
  svg.style.width = `${width / 7}em`;
  const path = document.createElementNS(svg.namespaceURI, 'path');
  const pixels: string[] = [];
  [...value].forEach((char, i) => {
    (GLYPHS[char] ?? GLYPHS['?'] ?? '').split(' ').forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell === '#') pixels.push(`M${i * 6 + x} ${y}h1v1h-1z`);
      });
    });
  });
  path.setAttribute('d', pixels.join(''));
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  const readable = document.createElement('span');
  readable.className = 'lobby-readable';
  readable.textContent = text;
  element.replaceChildren(readable, svg);
}
