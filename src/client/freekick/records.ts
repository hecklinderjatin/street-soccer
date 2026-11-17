import { freeKickChallenge } from '../challenge';
import { freeKickRankedMode } from '../../shared/freeKickChallenge';
import { context } from '@devvit/web/client';
import type {
  FreeKickBoards,
  FreeKickRun,
  FreeKickStats,
} from '../../shared/freeKick';

async function request(path: string, body: unknown) {
  const response = await fetch(`/api/freekick/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(
      typeof value.error === 'string' ? value.error : 'Request failed'
    );
  return value;
}
export class FreeKickRecords {
  private readonly id = crypto.randomUUID();
  private startRequest: Promise<FreeKickRun> | null = null;
  private finishSnapshot: FreeKickStats | null = null;
  private saving: Promise<FreeKickBoards> | null = null;
  private stoppedMs: number | null = null;
  private timing: { elapsedMs: number; locked: boolean; at: number } | null =
    null;
  elapsedMs() {
    if (this.stoppedMs !== null) return this.stoppedMs;
    return this.timing
      ? this.timing.elapsedMs +
          (this.timing.locked ? 0 : performance.now() - this.timing.at)
      : null;
  }
  get finishLocked() {
    return this.timing?.locked ?? false;
  }
  // Send the goal immediately, before the celebration/result delay.
  finish(result: FreeKickStats) {
    if (this.finishSnapshot) return;
    this.stoppedMs = this.elapsedMs();
    this.finishSnapshot = { ...result };
    void this.save(result).catch(() => {});
  }
  start() {
    if (this.startRequest || !context?.postId) return;
    this.startRequest = request('start', {
      id: this.id,
      mode: freeKickRankedMode(freeKickChallenge()),
    }).then((run: FreeKickRun) => {
      if (run.finish) this.timing = { ...run.finish, at: performance.now() };
      return run;
    });
    // A failed request must never block shooting or become an unhandled rejection.
    void this.startRequest.catch(() => {});
  }
  async save(result: FreeKickStats): Promise<FreeKickBoards> {
    if (this.saving) return this.saving;
    const send = async () => {
      if (!context?.postId)
        throw new Error('Leaderboards are available on Reddit');
      if (!this.startRequest) throw new Error('Run was not registered');
      const run = await this.startRequest;
      const boards: FreeKickBoards = await request('result', {
        ...run,
        mode: freeKickRankedMode(freeKickChallenge()),
        result: this.finishSnapshot ?? result,
      });
      const elapsedMs = boards.finish?.me?.value;
      if (elapsedMs !== undefined) {
        this.stoppedMs = elapsedMs;
        this.timing = { elapsedMs, locked: true, at: performance.now() };
      }
      return boards;
    };
    this.saving = send();
    try {
      return await this.saving;
    } catch (error) {
      this.saving = null;
      throw error;
    }
  }
  async post(comment: string, includeStats: boolean) {
    if (!context?.postId || !this.startRequest)
      throw new Error('Run unavailable');
    const run = await this.startRequest;
    return request('post-score', {
      ...run,
      mode: freeKickRankedMode(freeKickChallenge()),
      comment,
      includeStats,
    });
  }
}
