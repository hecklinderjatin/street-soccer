import { PITCH, CHAOS } from './tuning';
import type { MatchConfig, ChaosEffect } from './types';
export type { ChaosEffect } from './types';

export const CHAOS_EFFECTS = ['power', 'slippery', 'goals'] as const;
export const CHAOS_LABEL = {
  power: 'POWER SURGE',
  slippery: 'SLIPPERY STREET',
  goals: 'GOAL RESIZE',
} as const;
export type PitchGeometry = { [K in keyof typeof PITCH]: number };
export type ChaosRules = {
  pitch: PitchGeometry;
  power: number;
  movement: number;
  tackle: number;
  effect: ChaosEffect | null;
  strength: number;
};
export const NORMAL_RULES: ChaosRules = {
  pitch: PITCH,
  power: 1,
  movement: 1,
  tackle: 1,
  effect: null,
  strength: 100,
};
export const rulesOf = (entity: { rules?: ChaosRules }) =>
  entity.rules ?? NORMAL_RULES;
export const parseChaosEffect = (value: unknown) =>
  CHAOS_EFFECTS.find((effect) => effect === value);
export function chaosRules(
  config: Pick<
    MatchConfig,
    'mode' | 'dailyMode' | 'chaosEffect' | 'chaosStrength'
  >
): ChaosRules {
  if (
    config.mode === 'casual' ||
    config.dailyMode !== 'chaos' ||
    !config.chaosEffect
  )
    return NORMAL_RULES;
  const effect = config.chaosEffect,
    strength = config.chaosStrength ?? 100,
    scale = strength / 100;
  return {
    effect,
    strength,
    power: effect === 'power' ? scale : 1,
    movement: effect === 'slippery' ? scale : 1,
    tackle: effect === 'slippery' ? scale : 1,
    pitch:
      effect === 'goals'
        ? {
            ...PITCH,
            goalMouth: PITCH.goalMouth * scale,
            goalHeight: PITCH.goalHeight * scale,
            endWallHeight: PITCH.endWallHeight * scale,
            boxHeight: PITCH.boxHeight * scale,
            goalAreaHeight: PITCH.goalAreaHeight * scale,
          }
        : PITCH,
  };
}
export function chaosLabel(
  config: Pick<MatchConfig, 'dailyMode' | 'chaosEffect' | 'chaosStrength'>
) {
  return config.dailyMode === 'chaos' && config.chaosEffect
    ? `${CHAOS_LABEL[config.chaosEffect]} ${config.chaosStrength ?? 100}%`
    : '';
}
export const chaosStrengthValid = (effect: ChaosEffect, value: unknown) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= (effect === 'slippery' ? 100 : CHAOS.minPercent) &&
  value <= CHAOS.maxPercent;
