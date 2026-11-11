import type { CustomKick } from '../../shared/freeKickCustom';

// The Playground page's line to its Free Kick scene: the kick being built,
// whether the settings sheet is up (no shooting, controls hidden) and how
// much of the view the sheet leaves showing, which the camera frames into.
// The scene reports back when it is ready and on every test goal.
export class PlaygroundLink {
  kick: CustomKick;
  editing = true;
  viewRatio = 1;
  changed: (() => void) | null = null; // set by the scene
  onReady: () => void = () => {};
  onGoal: () => void = () => {};
  onShot: () => void = () => {};

  constructor(kick: CustomKick) {
    this.kick = kick;
  }

  update(next: { kick?: CustomKick; editing?: boolean; viewRatio?: number }) {
    if (next.kick) this.kick = next.kick;
    if (next.editing !== undefined) this.editing = next.editing;
    if (next.viewRatio !== undefined) this.viewRatio = next.viewRatio;
    this.changed?.();
  }
}
