import { parseDailyMode } from './dailyMode';
import { CUSTOM_MATCH, MATCH, DAILY } from './tuning';
import {
  DIFFICULTIES,
  FORMATION_NAMES,
  JERSEY_COLORS,
  type MatchConfig,
  type TeamSetup,
} from './types';

// Custom match settings: the defaults, and the one validator shared by the
// server (a moderator's form) and the client (the post's saved postData).

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  difficulty: 'normal',
  durationSec: MATCH.durationSec,
  startGoalsAgainst: 0,
  home: { name: 'YOU', jersey: 'pink', formation: '2-1-1' },
  away: { name: 'OPP', jersey: 'blue', formation: '2-1-1' },
  locked: false,
};

// Match lengths a moderator can pick (seconds).
export const DURATION_CHOICES: readonly number[] = Array.from(
  {
    length:
      (CUSTOM_MATCH.maxDurationSec - CUSTOM_MATCH.minDurationSec) /
        CUSTOM_MATCH.durationStepSec +
      1,
  },
  (_, i) => CUSTOM_MATCH.minDurationSec + i * CUSTOM_MATCH.durationStepSec
);

export const formatClock = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

// Upper-cased, trimmed, single-spaced; null if empty, too long or using a
// character the pixel font can't draw.
export function cleanTeamName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ').toUpperCase();
  if (!name || name.length > CUSTOM_MATCH.nameMaxLength) return null;
  return /^[A-Z0-9 ]+$/.test(name) ? name : null;
}

const pick = <T extends string>(
  choices: readonly T[],
  value: unknown
): T | null => choices.find((c) => c === value) ?? null;

const wholeIn = (value: unknown, min: number, max: number) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max
    ? value
    : null;

function parseTeam(value: unknown): TeamSetup | string {
  if (typeof value !== 'object' || value === null) return 'team missing';
  const name = cleanTeamName(Reflect.get(value, 'name'));
  if (!name)
    return `team names: 1-${CUSTOM_MATCH.nameMaxLength} letters, digits or spaces`;
  const jersey = pick(JERSEY_COLORS, Reflect.get(value, 'jersey'));
  if (!jersey) return 'unknown jersey colour';
  // Retired shape: keep older posts and device preferences playable.
  const savedFormation = Reflect.get(value, 'formation');
  const formation = pick(
    FORMATION_NAMES,
    savedFormation === '0-3-1' ? '1-2-1' : savedFormation
  );
  if (!formation) return 'unknown formation';
  return { name, jersey, formation };
}

// A complete, valid config, or the reason it isn't one.
export function parseMatchConfig(value: unknown): MatchConfig | string {
  if (typeof value !== 'object' || value === null) return 'no settings';
  const casual = Reflect.get(value, 'mode') === 'casual';
  const rawDaily = casual ? undefined : Reflect.get(value, 'dailyMode');
  const dailyMode = parseDailyMode(rawDaily);
  if (rawDaily !== undefined && !dailyMode) return 'unknown daily challenge';
  const difficulty = pick(DIFFICULTIES, Reflect.get(value, 'difficulty'));
  if (!difficulty) return 'unknown difficulty';
  const durationSec = wholeIn(
    Reflect.get(value, 'durationSec'),
    CUSTOM_MATCH.minDurationSec,
    CUSTOM_MATCH.maxDurationSec
  );
  if (durationSec === null)
    return `match length: ${formatClock(CUSTOM_MATCH.minDurationSec)} to ${formatClock(CUSTOM_MATCH.maxDurationSec)}`;
  const startGoalsAgainst = wholeIn(
    Reflect.get(value, 'startGoalsAgainst'),
    0,
    CUSTOM_MATCH.maxStartGoals
  );
  if (startGoalsAgainst === null)
    return `goals conceded: 0 to ${CUSTOM_MATCH.maxStartGoals}`;
  const startGoalsFor = casual
    ? 0
    : wholeIn(
        Reflect.get(value, 'startGoalsFor') ?? 0,
        0,
        CUSTOM_MATCH.maxStartGoals
      );
  if (startGoalsFor === null) return 'invalid starting lead';
  if (
    dailyMode === 'hold-lead' &&
    (startGoalsFor < 1 || startGoalsAgainst !== 0)
  )
    return 'Shield needs a player lead and no AI head start';
  if (dailyMode !== 'hold-lead' && startGoalsFor !== 0)
    return 'only Shield can start with player goals';
  if (dailyMode === 'comeback' && startGoalsAgainst < 1)
    return 'comeback needs an AI head start';
  if (
    dailyMode === 'survival' &&
    (startGoalsAgainst !== 0 || difficulty !== 'noob')
  )
    return 'survival starts 0-0 at Noob';
  const survivalGoals = wholeIn(
    Reflect.get(value, 'survivalGoals') ?? DAILY.survivalGoals,
    1,
    DAILY.maxSurvivalGoals
  );
  const survivalConceded = wholeIn(
    Reflect.get(value, 'survivalConceded') ?? DAILY.survivalConceded,
    1,
    DAILY.maxSurvivalConceded
  );
  if (
    dailyMode === 'survival' &&
    (survivalGoals === null || survivalConceded === null)
  )
    return 'invalid Rampage goal limits';
  const home = parseTeam(Reflect.get(value, 'home'));
  if (typeof home === 'string') return home;
  const away = parseTeam(Reflect.get(value, 'away'));
  if (typeof away === 'string') return away;
  if (home.jersey === away.jersey)
    return 'the two teams need different jersey colours';
  return {
    mode: casual ? 'casual' : 'competitive',
    ...(dailyMode ? { dailyMode, startGoalsFor } : {}),
    ...(dailyMode === 'survival'
      ? {
          survivalGoals: survivalGoals ?? DAILY.survivalGoals,
          survivalConceded: survivalConceded ?? DAILY.survivalConceded,
        }
      : {}),
    difficulty,
    durationSec,
    startGoalsAgainst,
    home,
    away,
    locked: Reflect.get(value, 'locked') === true,
  };
}
