import { FREE_KICK as FK } from '../../shared/tuning';

export function practiceLevel(value: unknown) {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= FK.maxLevel
    ? value
    : 1;
}
