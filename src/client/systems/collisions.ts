import { PLAYER } from '../../shared/tuning';
import type { Player } from '../entities/Player';

// Players are circles on the ground (PLAYER.bodyRadius) that can't overlap:
// each overlapping pair is pushed apart, half each, along the line between
// them. Run after movement; callers re-apply court limits afterwards.
export function separatePlayers(players: readonly Player[]) {
  const min = PLAYER.bodyRadius * 2;
  for (let i = 0; i < players.length; i++) {
    const a = players[i];
    if (!a) continue;
    for (let j = i + 1; j < players.length; j++) {
      const b = players[j];
      if (!b) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d >= min) continue;
      if (d < 0.001) {
        // Exactly stacked: split them sideways.
        dx = 0;
        dy = 1;
        d = 1;
      }
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
    }
  }
}
