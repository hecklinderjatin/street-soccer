import { freeKickChallenge } from '../challenge';
import { freeKickRankedMode } from '../../shared/freeKickChallenge';
import { context } from '@devvit/web/client';
import type { FreeKickRun, FreeKickStats } from '../../shared/freeKick';

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
  private run: FreeKickRun | null = null;
  start() {
    if (this.startRequest || !context?.postId) return;
    this.startRequest = request('start', {
      id: this.id,
      mode: freeKickRankedMode(freeKickChallenge()),
    }).then((value) => {
      this.run = value;
      return value;
    });
    // A failed request must never block shooting or become an unhandled rejection.
    void this.startRequest.catch(() => {});
  }
  async save(result: FreeKickStats) {
    if (!context?.postId)
      throw new Error('Leaderboards and score sharing are available on Reddit');
    if (!this.startRequest) throw new Error('Run was not registered');
    const run = await this.startRequest;
    await request('result', {
      ...run,
      mode: freeKickRankedMode(freeKickChallenge()),
      result,
    });
  }
  async post(comment: string, includeStats: boolean) {
    if (!this.run) throw new Error('Save the run before sharing');
    return request('post-score', {
      ...this.run,
      mode: freeKickRankedMode(freeKickChallenge()),
      comment,
      includeStats,
    });
  }
}
