import {
  DAILY_MODES,
  DAILY_LABEL,
  parseDailyMode,
} from '../../shared/dailyMode';
import type { DailyMode } from '../../shared/types';
import type { Form, FormField } from '@devvit/web/shared';
import {
  DEFAULT_MATCH_CONFIG,
  DURATION_CHOICES,
  formatClock,
} from '../../shared/matchConfig';
import {
  POST_TYPES,
  POST_TYPE_LABEL,
  parsePostType,
  type PostType,
} from '../../shared/postType';
import { CUSTOM_MATCH, DAILY } from '../../shared/tuning';
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  FORMATION_NAMES,
  JERSEY_COLORS,
  type MatchConfig,
} from '../../shared/types';

// The moderator's "create a match" form (menu: Create Street Soccer match)
// and turning its answers into a post title, splash text and MatchConfig.

export const CHALLENGE_FORM = 'challengeForm'; // devvit.json "forms" key

// What the form submits: text fields as strings, selects as one-item arrays.
export type ChallengeValues = {
  matchType?: string[];
  dailyMode?: string[];
  startGoalsFor?: string[];
  survivalGoals?: string[];
  survivalConceded?: string[];
  title?: string;
  description?: string;
  homeName?: string;
  homeJersey?: string[];
  homeFormation?: string[];
  awayName?: string;
  awayJersey?: string[];
  awayFormation?: string[];
  difficulty?: string[];
  durationSec?: string[];
  startGoalsAgainst?: string[];
};

export type Challenge = {
  matchType: PostType;
  title: string;
  description: string;
  config: MatchConfig;
};

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const options = (values: readonly string[], label = capital) =>
  values.map((value) => ({ value, label: label(value) }));

const teamFields = (side: 'home' | 'away'): FormField[] => [
  {
    type: 'string',
    name: `${side}Name`,
    label: 'Team label',
    helpText: `Shown on the scoreboard: up to ${CUSTOM_MATCH.nameMaxLength} letters, digits or spaces`,
    required: true,
  },
  {
    type: 'select',
    name: `${side}Jersey`,
    label: 'Jersey colour',
    options: options(JERSEY_COLORS),
    required: true,
  },
  {
    type: 'select',
    name: `${side}Formation`,
    label: 'Formation (defence-midfield-attack)',
    options: options(FORMATION_NAMES, (f) => f),
    required: true,
  },
];

export const MATCH_TYPE_FORM = 'matchTypeForm';
export const matchTypeForm: Form = {
  title: 'Create a Street Soccer match',
  acceptLabel: 'Continue',
  fields: [
    {
      type: 'select',
      name: 'matchType',
      label: 'Match type',
      required: true,
      defaultValue: ['daily'],
      options: POST_TYPES.map((value) => ({
        value,
        label: POST_TYPE_LABEL[value],
      })),
    },
  ],
};

export const DAILY_MODE_FORM = 'dailyModeForm';
export const dailyModeForm: Form = {
  title: 'Choose a Daily Challenge',
  acceptLabel: 'Continue',
  fields: [
    {
      type: 'select',
      name: 'dailyMode',
      label: 'Daily challenge type',
      required: true,
      defaultValue: ['comeback'],
      options: DAILY_MODES.map((value) => ({
        value,
        label: DAILY_LABEL[value],
      })),
      helpText:
        'Comeback: recover a deficit. Hold the Lead: defend your head start. Survival: race to a goal target with rising difficulty and a concession limit.',
    },
  ],
};

export function challengeFormFor(
  matchType: PostType,
  dailyMode: DailyMode = 'comeback'
): Form {
  const dailyFields: FormField[] =
    matchType === 'daily'
      ? [
          {
            type: 'select',
            name: 'dailyMode',
            label: 'Daily challenge type',
            required: true,
            defaultValue: [dailyMode],
            options: [{ value: dailyMode, label: DAILY_LABEL[dailyMode] }],
            helpText:
              dailyMode === 'survival'
                ? 'Start at Noob, rise after goals up to Pro. Finish your goal target before your concession limit or the fixed five-minute cap. Fastest finishers rank first.'
                : 'Finish ahead at the whistle. No golden goal. To change type, cancel and reopen the creation menu.',
          },
        ]
      : [];
  const leadFields: FormField[] =
    matchType === 'daily' && dailyMode === 'hold-lead'
      ? [
          {
            type: 'select',
            name: 'startGoalsFor',
            label: 'Your starting lead',
            required: true,
            options: Array.from(
              { length: CUSTOM_MATCH.maxStartGoals },
              (_, i) => ({ value: String(i + 1), label: `${i + 1} - 0` })
            ),
          },
        ]
      : [];
  const survivalFields: FormField[] =
    matchType === 'daily' && dailyMode === 'survival'
      ? [
          {
            type: 'select',
            name: 'survivalGoals',
            label: 'Goals to win',
            required: true,
            options: Array.from({ length: DAILY.maxSurvivalGoals }, (_, i) => ({
              value: String(i + 1),
              label: String(i + 1),
            })),
          },
          {
            type: 'select',
            name: 'survivalConceded',
            label: 'Conceding goal limit',
            required: true,
            helpText: 'The run ends when the opponent reaches this many goals.',
            options: Array.from(
              { length: DAILY.maxSurvivalConceded },
              (_, i) => ({ value: String(i + 1), label: String(i + 1) })
            ),
          },
        ]
      : [];
  return {
    title: 'Create a Street Soccer match',
    description:
      matchType === 'casual'
        ? 'Create a Casual post from your Reddit account. Players freely choose their formations, difficulty and match time.'
        : 'Create a post from your Reddit account. Ranked matches use these fixed settings; players can also choose unranked Casual.',
    acceptLabel: 'Create post',
    fields: [
      {
        type: 'select',
        name: 'matchType',
        label: 'Match type',
        required: true,
        defaultValue: [matchType],
        options: [{ value: matchType, label: POST_TYPE_LABEL[matchType] }],
        helpText:
          'To choose a different type, cancel and reopen Create Street Soccer match.',
      },
      {
        type: 'string',
        name: 'title',
        label: 'Post title',
        required: true,
      },
      {
        type: 'paragraph',
        name: 'description',
        label: 'Description (optional)',
        helpText: `Shown on the post before playing, up to ${CUSTOM_MATCH.descriptionMaxLength} characters`,
      },
      ...dailyFields,
      ...(matchType === 'casual'
        ? []
        : matchFields
            .filter((field) => {
              if (matchType !== 'daily') return true;
              if (
                field.type === 'select' &&
                ['difficulty', 'durationSec'].includes(field.name) &&
                dailyMode === 'survival'
              )
                return false;
              if (field.type === 'select' && field.name === 'startGoalsAgainst')
                return dailyMode === 'comeback';
              return true;
            })
            .map((field) =>
              field.type === 'select' &&
              field.name === 'startGoalsAgainst' &&
              matchType === 'daily'
                ? {
                    ...field,
                    options: field.options.filter(
                      (option) => option.value !== '0'
                    ),
                  }
                : field
            )),
      ...leadFields,
      ...survivalFields,
    ],
  };
}

const matchFields: FormField[] = [
  { type: 'group', label: "Player's team", fields: teamFields('home') },
  { type: 'group', label: 'AI team', fields: teamFields('away') },
  {
    type: 'select',
    name: 'difficulty',
    label: 'Bot difficulty',
    options: DIFFICULTIES.map((value) => ({
      value,
      label: capital(DIFFICULTY_LABEL[value].toLowerCase()),
    })),
    required: true,
  },
  {
    type: 'select',
    name: 'durationSec',
    label: `Match length (max ${formatClock(CUSTOM_MATCH.maxDurationSec)})`,
    options: DURATION_CHOICES.map((sec) => ({
      value: String(sec),
      label: formatClock(sec),
    })),
    required: true,
  },
  {
    type: 'select',
    name: 'startGoalsAgainst',
    label: 'Goals already conceded at kickoff',
    helpText: 'The AI starts this many goals up (0 = a normal 0-0 start)',
    options: Array.from({ length: CUSTOM_MATCH.maxStartGoals + 1 }, (_, n) => ({
      value: String(n),
      label: String(n),
    })),
    required: true,
  },
];

export const challengeForm = challengeFormFor('daily');

// The form's starting values: the default match, or a rejected submission.
export function challengeFormData(values?: ChallengeValues): ChallengeValues {
  const d = DEFAULT_MATCH_CONFIG;
  const dailyMode = parseDailyMode(values?.dailyMode?.[0]) ?? 'comeback';
  return {
    dailyMode: [dailyMode],
    startGoalsFor: ['1'],
    survivalGoals: [String(DAILY.survivalGoals)],
    survivalConceded: [String(DAILY.survivalConceded)],
    matchType: ['daily'],
    title: 'Street Soccer challenge',
    description: '',
    homeName: d.home.name,
    homeJersey: [d.home.jersey],
    homeFormation: [d.home.formation],
    awayName: d.away.name,
    awayJersey: [d.away.jersey],
    awayFormation: [d.away.formation],
    difficulty: [d.difficulty],
    durationSec: [String(d.durationSec)],
    startGoalsAgainst: [values?.matchType?.[0] === 'daily' ? '2' : '0'],
    ...values,
  };
}

// The submitted answers as a challenge, or why they can't be one. The
// config itself is checked by parseMatchConfig (shared with the client).
export function readChallenge(
  values: ChallengeValues,
  parse: (raw: unknown) => MatchConfig | string
): Challenge | string {
  const matchType =
    values.matchType === undefined
      ? 'daily'
      : parsePostType(values.matchType[0]);
  if (!matchType) return 'Choose a valid match type';
  const title = (values.title ?? '').trim();
  if (!title || title.length > CUSTOM_MATCH.titleMaxLength)
    return `Title: 1 to ${CUSTOM_MATCH.titleMaxLength} characters`;
  const description = (values.description ?? '').trim();
  if (description.length > CUSTOM_MATCH.descriptionMaxLength)
    return `Challenge text: at most ${CUSTOM_MATCH.descriptionMaxLength} characters`;
  if (matchType === 'casual')
    return {
      title,
      description,
      matchType,
      config: { ...DEFAULT_MATCH_CONFIG, mode: 'casual', locked: false },
    };
  const dailyMode =
    matchType === 'daily' ? parseDailyMode(values.dailyMode?.[0]) : undefined;
  if (matchType === 'daily' && values.dailyMode !== undefined && !dailyMode)
    return 'Choose a valid Daily challenge type';
  const config = parse({
    ...(dailyMode
      ? {
          dailyMode,
          startGoalsFor:
            dailyMode === 'hold-lead' ? Number(values.startGoalsFor?.[0]) : 0,
        }
      : {}),
    ...(dailyMode === 'survival'
      ? {
          survivalGoals: Number(values.survivalGoals?.[0]),
          survivalConceded: Number(values.survivalConceded?.[0]),
        }
      : {}),
    difficulty: dailyMode === 'survival' ? 'noob' : values.difficulty?.[0],
    durationSec:
      dailyMode === 'survival'
        ? DAILY.survivalCapSec
        : Number(values.durationSec?.[0]),
    startGoalsAgainst:
      dailyMode && dailyMode !== 'comeback'
        ? 0
        : Number(values.startGoalsAgainst?.[0]),
    home: {
      name: values.homeName,
      jersey: values.homeJersey?.[0],
      formation: values.homeFormation?.[0],
    },
    away: {
      name: values.awayName,
      jersey: values.awayJersey?.[0],
      formation: values.awayFormation?.[0],
    },
    locked: true,
    mode: 'competitive',
  });
  if (typeof config === 'string') return capital(config);
  return { title, description, matchType, config };
}
