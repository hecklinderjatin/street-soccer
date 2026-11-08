import type { ScreenPoint } from './rules';

export type FreeKickGesture = 'contact' | 'power' | 'swipe';

export function freeKickControls(width: number, height: number) {
  const top = height * 0.43;
  const bottom = top + Math.min(330, height * 0.26);
  return {
    power: { x: 76, top, bottom },
    contact: { x: 76, y: bottom + 126, radius: 40, frame: 50 },
    shooting: { left: 154, top: 200, right: width, bottom: height },
  };
}

// The control where a gesture starts owns it until release. A settings drag
// crossing the pitch must never turn into a shot, or change a shooting swipe.
export function freeKickGesture(
  point: ScreenPoint,
  layout: ReturnType<typeof freeKickControls>
): FreeKickGesture | null {
  const { contact, power, shooting } = layout;
  if (
    Math.abs(point.x - contact.x) <= contact.frame &&
    Math.abs(point.y - contact.y) <= contact.frame
  )
    return 'contact';
  if (
    Math.abs(point.x - power.x) <= 58 &&
    point.y >= power.top - 54 &&
    point.y <= power.bottom + 58
  )
    return 'power';
  if (
    point.x >= shooting.left &&
    point.x <= shooting.right &&
    point.y >= shooting.top &&
    point.y <= shooting.bottom
  )
    return 'swipe';
  return null;
}
