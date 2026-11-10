import { FREEKICK_FRAMES } from '../art/playerSheets';
import { FREE_KICK as FK } from '../../shared/tuning';

// The free kick taker's pose from the strike sheet (see FREEKICK_FRAMES):
// pose 1 while waiting, poses 2-7 spread over the run-up (`run` 0 to 1,
// ending on the strike), then follow-through, recovery and the standing
// watch `play` seconds after the strike.
//
// The sheet is drawn as a right-curl strike. A left-curl kick (`curlLeft`)
// plays the same sheet mirrored from the strike (pose 7) on: `mirror` says
// to flip the sprite relative to the way the run-up is drawn.
const RUNUP_POSES = 6; // freekick2 .. freekick7
const AFTER_POSES = 5; // freekick8 .. freekick12
const STRIKE_POSE = 6; // freekick7: the moment of the shot

export function kickerFrame(
  run: number | null,
  play: number | null,
  curlLeft = false
) {
  let pose = 0;
  if (play !== null)
    pose =
      1 +
      RUNUP_POSES +
      Math.min(AFTER_POSES - 1, Math.floor(play / FK.strikePoseSec));
  else if (run !== null && run > 0)
    pose = 1 + Math.min(RUNUP_POSES - 1, Math.floor(run * RUNUP_POSES));
  return {
    frame: FREEKICK_FRAMES[pose] ?? 'freekick1',
    mirror: curlLeft && pose >= STRIKE_POSE,
  };
}
