import type { Form, FormField } from '@devvit/web/shared';
import {
  DEFAULT_MATCH_CONFIG,
  DURATION_CHOICES,
  formatClock,
} from '../../shared/matchConfig';
import { CUSTOM_MATCH } from '../../shared/tuning';
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

export const challengeForm: Form = {
  title: 'Create a Street Soccer match',
  description:
    'Create a post from your Reddit account. Players get exactly these settings; they cannot change them in the game.',
  acceptLabel: 'Create post',
  fields: [
    {
      type: 'string',
      name: 'title',
      label: 'Post title',
      required: true,
    },
    {
      type: 'paragraph',
      name: 'description',
      label: 'Challenge text (optional)',
      helpText: `Shown on the post before playing, up to ${CUSTOM_MATCH.descriptionMaxLength} characters`,
    },
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
      options: Array.from(
        { length: CUSTOM_MATCH.maxStartGoals + 1 },
        (_, n) => ({
          value: String(n),
          label: String(n),
        })
      ),
      required: true,
    },
  ],
};

// The form's starting values: the default match, or a rejected submission.
export function challengeFormData(values?: ChallengeValues): ChallengeValues {
  const d = DEFAULT_MATCH_CONFIG;
  return {
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
    startGoalsAgainst: ['0'],
    ...values,
  };
}

// The submitted answers as a challenge, or why they can't be one. The
// config itself is checked by parseMatchConfig (shared with the client).
export function readChallenge(
  values: ChallengeValues,
  parse: (raw: unknown) => MatchConfig | string
): Challenge | string {
  const title = (values.title ?? '').trim();
  if (!title || title.length > CUSTOM_MATCH.titleMaxLength)
    return `Title: 1 to ${CUSTOM_MATCH.titleMaxLength} characters`;
  const description = (values.description ?? '').trim();
  if (description.length > CUSTOM_MATCH.descriptionMaxLength)
    return `Challenge text: at most ${CUSTOM_MATCH.descriptionMaxLength} characters`;
  const config = parse({
    difficulty: values.difficulty?.[0],
    durationSec: Number(values.durationSec?.[0]),
    startGoalsAgainst: Number(values.startGoalsAgainst?.[0]),
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
  });
  if (typeof config === 'string') return capital(config);
  return { title, description, config };
}
