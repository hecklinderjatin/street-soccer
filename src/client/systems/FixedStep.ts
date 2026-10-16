import { SIM } from '../../shared/tuning';

// Runs the simulation at a fixed rate, independent of render speed, so the
// game plays the same on slow and fast phones.
export class FixedStep {
  readonly dt = 1 / SIM.hz;
  private accumulator = 0;

  reset() {
    this.accumulator = 0;
  }

  // Runs as many whole steps as the elapsed time allows and returns the
  // leftover fraction of a step (0..1) for render interpolation.
  advance(deltaMs: number, step: (dt: number) => void) {
    // Clamp so a long stall (tab hidden, GC) can't trigger a burst of steps.
    this.accumulator += Math.min(
      deltaMs / 1000,
      SIM.maxStepsPerFrame * this.dt
    );
    while (this.accumulator >= this.dt) {
      step(this.dt);
      this.accumulator -= this.dt;
    }
    return this.accumulator / this.dt;
  }
}
