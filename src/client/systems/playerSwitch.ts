import type { Ball } from '../entities/Ball';
import type { Player } from '../entities/Player';
import { interceptPoint } from './ai';
import { INPUT } from '../../shared/tuning';

export type SwitchCycle = {
  players: Player[];
  index: number;
  lastAt: number;
};

// Read-only planning shared by the preview and the actual button press.
export function nextSwitchSelection(
  teammates: Player[],
  controlled: Player,
  ball: Ball,
  preferred: Player | null,
  cycle: SwitchCycle,
  time: number
) {
  if (time - cycle.lastAt > INPUT.switchCycleSec || !cycle.players.length) {
    const players = switchOrder(teammates, controlled, ball, preferred);
    return { players, index: 0, target: players[0] ?? null };
  }
  for (let offset = 1; offset <= cycle.players.length; offset++) {
    const index = (cycle.index + offset) % cycle.players.length;
    const target = cycle.players[index];
    if (target && target !== controlled && target.role !== 'keeper')
      return { players: cycle.players, index, target };
  }
  return { players: cycle.players, index: cycle.index, target: null };
}

// Only outfielders can be selected by SWITCH, including an AI priority pick.
export function switchOrder(
  teammates: Player[],
  controlled: Player,
  ball: Ball,
  preferred: Player | null
): Player[] {
  const candidates = teammates
    .filter((p) => p !== controlled && p.role !== 'keeper')
    .map((p) => ({ player: p, time: interceptPoint(p, ball).t }))
    .sort((a, b) => a.time - b.time)
    .map(({ player }) => player);
  if (preferred && candidates.includes(preferred))
    return [preferred, ...candidates.filter((p) => p !== preferred)];
  return candidates;
}
