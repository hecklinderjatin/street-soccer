import type { Form } from '@devvit/web/shared';

export const privacyForm: Form = {
  title: 'Delete my Street Soccer data',
  description:
    'Remove your saved scores and results from every Street Soccer leaderboard in this subreddit. Reddit posts and comments remain under your Reddit account controls. Future completed matches can save new scores.',
  acceptLabel: 'Delete my data',
  cancelLabel: 'Cancel',
  fields: [
    {
      name: 'confirmed',
      type: 'boolean',
      label: 'Delete all my saved leaderboard results',
      defaultValue: false,
    },
  ],
};
