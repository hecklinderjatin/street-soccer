import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_MATCH_CONFIG,
  parseMatchConfig,
} from '../src/shared/matchConfig';
import {
  DAILY_LABEL,
  DAILY_MODES,
  challengeCleared,
  dailyPlans,
  resultRankScore,
  startScore,
  withoutDailyMode,
} from '../src/shared/dailyMode';
import { DIFFICULTIES } from '../src/shared/types';
import { DAILY, MATCH, TACTICS } from '../src/shared/tuning';
import { casualConfig } from '../src/shared/casual';
import { MatchFlow } from '../src/client/systems/MatchFlow';
import {
  challengeFormFor,
  challengeFormData,
  readChallenge,
  DAILY_MODE_FORM,
  dailyModeForm,
} from '../src/server/core/challengeForm';
import { readStats, postConfig } from '../src/server/core/matchStats';
import { gameMinimumSeconds } from '../src/server/core/gamesPlayed';
import { statsLine } from '../src/server/core/scoreComment';

const configs = DAILY_MODES.map((mode) => {
  const form = challengeFormFor('daily', mode);
  assert.ok(
    form.fields.some(
      (field) => field.type === 'select' && field.name === 'dailyMode'
    )
  );
  const result = readChallenge(
    challengeFormData({ matchType: ['daily'], dailyMode: [mode] }),
    parseMatchConfig
  );
  assert.notEqual(typeof result, 'string');
  if (typeof result === 'string') throw new Error(result);
  assert.equal(result.config.dailyMode, mode);
  assert.deepEqual(
    parseMatchConfig(JSON.parse(JSON.stringify(result.config))),
    result.config
  );
  assert.equal(
    postConfig({ matchType: 'daily', match: result.config })?.dailyMode,
    mode
  );
  assert.equal(
    postConfig({ matchType: 'classic', match: result.config })?.dailyMode,
    undefined
  );
  assert.equal(casualConfig(result.config).dailyMode, undefined);
  assert.equal(casualConfig(result.config).startGoalsFor, undefined);
  return result.config;
});
const comeback = configs[0],
  lead = configs[1],
  survival = configs[2];
assert.ok(comeback && lead && survival);
assert.deepEqual(startScore(comeback), { home: 0, away: 2 });
assert.deepEqual(startScore(lead), { home: 1, away: 0 });
assert.deepEqual(startScore(survival), { home: 0, away: 0 });
assert.equal(survival.difficulty, 'noob');
assert.ok(
  !challengeFormFor('daily', 'survival').fields.some(
    (field) =>
      field.type === 'select' &&
      ['difficulty', 'startGoalsAgainst', 'startGoalsFor'].includes(field.name)
  )
);
assert.ok(
  challengeFormFor('daily', 'hold-lead').fields.some(
    (field) => field.type === 'select' && field.name === 'startGoalsFor'
  )
);
assert.equal(dailyModeForm.fields[0]?.type, 'select');
const manifest = JSON.parse(readFileSync('devvit.json', 'utf8'));
assert.equal(manifest.forms[DAILY_MODE_FORM], '/internal/form/daily-mode');
assert.equal(
  typeof parseMatchConfig({ ...comeback, startGoalsAgainst: 0 }),
  'string'
);
assert.equal(typeof parseMatchConfig({ ...lead, startGoalsFor: 0 }), 'string');
assert.equal(
  typeof parseMatchConfig({ ...survival, difficulty: 'hard' }),
  'string'
);
assert.equal(
  typeof parseMatchConfig({ ...survival, dailyMode: 'chaos' }),
  'string'
);
assert.equal(withoutDailyMode(lead).dailyMode, undefined);

// State-specific tactics are independent of the physics/difficulty row.
assert.equal(
  dailyPlans(comeback, { home: 0, away: 2 }, 90).away,
  TACTICS.defensive
);
assert.equal(
  dailyPlans(comeback, { home: 2, away: 2 }, 45).away,
  TACTICS.balanced
);
assert.equal(
  dailyPlans(comeback, { home: 3, away: 2 }, 20).away,
  TACTICS.attacking
);
assert.equal(
  dailyPlans(lead, { home: 1, away: 0 }, lead.durationSec).away,
  TACTICS.attacking
);
assert.equal(dailyPlans(lead, { home: 1, away: 0 }, 1).away, TACTICS.allOut);
assert.equal(
  dailyPlans(lead, { home: 1, away: 0 }, 45).home,
  TACTICS.defensive
);
assert.equal(
  dailyPlans(lead, { home: 1, away: 2 }, 45).away,
  TACTICS.defensive
);
assert.equal(
  dailyPlans(lead, { home: 1, away: 2 }, 45).home,
  TACTICS.attacking
);
for (const [goals, difficulty] of DIFFICULTIES.entries()) {
  assert.equal(
    dailyPlans(survival, { home: goals, away: 2 }, 30).difficulty,
    difficulty
  );
  assert.equal(
    dailyPlans(survival, { home: goals, away: 2 }, 30).away,
    TACTICS.balanced
  );
}
assert.equal(
  dailyPlans({ ...lead, mode: 'casual' }, { home: 1, away: 0 }, 1).away,
  TACTICS.balanced
);

for (const config of configs) {
  const flow = new MatchFlow(
    config.durationSec,
    startScore(config),
    config.dailyMode
  );
  flow.phase = 'live';
  flow.awaitingKickoff = false;
  flow.clockRunning = true;
  flow.score = { home: 1, away: 1 };
  flow.tickClock(config.durationSec);
  assert.equal(flow.phase, 'fulltime');
  assert.equal(flow.goldenGoal, false);
  assert.equal(flow.elapsedSec, config.durationSec);
}
const legacy = new MatchFlow(30);
legacy.phase = 'live';
legacy.clockRunning = true;
legacy.tickClock(30);
assert.equal(legacy.goldenGoal, true, 'legacy/Classic keep their golden goal');
const run = new MatchFlow(120, { home: 0, away: 0 }, 'survival');
for (let goal = 1; goal <= 5; goal++) {
  run.phase = 'live';
  run.awaitingKickoff = false;
  run.onGoal('home');
  assert.equal(run.phase, 'goal');
  run.update(MATCH.goalHitStopSec + MATCH.celebrationSec);
  assert.equal(run.phase, goal === 5 ? 'fulltime' : 'kickoff');
}
assert.equal(challengeCleared('survival', 5, 2), true);
assert.equal(
  challengeCleared('survival', 4, 3),
  false,
  'leading on score is not Survival success'
);
const failed = new MatchFlow(120, { home: 4, away: 2 }, 'survival');
failed.phase = 'live';
failed.onGoal('away');
failed.update(MATCH.goalHitStopSec + MATCH.celebrationSec);
assert.equal(failed.phase, 'fulltime');

const stats = {
  difficulty: 'noob',
  goalsFor: 5,
  goalsAgainst: 1,
  shots: 10,
  passes: 8,
  tacklesWon: 2,
  elapsedSec: 40,
};
const clear = readStats(
  { ...stats, cleared: false, dailyMode: 'hold-lead' },
  survival
);
assert.ok(typeof clear !== 'string');
assert.equal(clear.cleared, true);
assert.equal(clear.dailyMode, 'survival');
const lost = readStats({ ...stats, goalsFor: 4, goalsAgainst: 3 }, survival);
assert.ok(typeof lost !== 'string');
assert.equal(lost.cleared, false);
assert.ok(statsLine(lost, survival).includes('Failed SURVIVAL'));
assert.equal(typeof readStats({ ...stats, goalsFor: 6 }, survival), 'string');
assert.equal(
  typeof readStats({ ...stats, goalsAgainst: 3 }, survival),
  'string'
);
assert.equal(
  typeof readStats({ ...stats, goalsFor: 2, goalsAgainst: 1 }, survival),
  'string',
  'cannot report a premature non-terminal run'
);
assert.equal(typeof readStats({ ...stats, elapsedSec: 0 }, survival), 'string');
assert.equal(
  typeof readStats({ ...stats, elapsedSec: 400 }, survival),
  'string'
);
const timeout = readStats(
  { ...stats, goalsFor: 4, goalsAgainst: 0, elapsedSec: survival.durationSec },
  survival
);
assert.ok(typeof timeout !== 'string');
assert.equal(timeout.cleared, false);
assert.deepEqual(
  readStats(clear, null, true),
  clear,
  'saved challenge metadata survives leaderboard reads'
);
assert.equal(
  typeof readStats(
    {
      ...stats,
      goalsFor: 1,
      goalsAgainst: 0,
      fastestGoalKmh: 100,
      elapsedSec: lead.durationSec,
    },
    lead
  ),
  'string',
  'starting goals cannot justify a speed record'
);
assert.ok(resultRankScore(clear) > resultRankScore(lost));
assert.ok(
  resultRankScore({ ...clear, goalsAgainst: 0, elapsedSec: 90 }) >
    resultRankScore({ ...clear, goalsAgainst: 1, elapsedSec: 20 })
);
assert.ok(
  resultRankScore({ ...clear, elapsedSec: 20 }) >
    resultRankScore({ ...clear, elapsedSec: 30 })
);
assert.equal(
  gameMinimumSeconds(survival, { matchType: 'daily', match: survival }),
  DAILY.earlyFinishMinSec
);
assert.equal(
  gameMinimumSeconds(casualConfig(), { matchType: 'daily', match: survival }),
  DEFAULT_MATCH_CONFIG.durationSec * 0.8
);
console.log(
  `Daily modes passed: ${Object.values(DAILY_LABEL).join(', ')}; forms, tactics, progression, endings, rankings, validation and early receipts`
);
