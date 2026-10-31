import { GOAL_FEEDBACK, CHAOS } from '../shared/tuning';

// Device-local, anonymous records; Casual and fixed ranked matches are separate.
export function recordGoalSpeed(kmh: number, casual: boolean, chaos = false) {
  const key = `street-soccer:fastest-goal:v1:${chaos ? 'chaos' : casual ? 'casual' : 'ranked'}`;
  try {
    const raw = Number(localStorage.getItem(key) ?? 0);
    const previous =
      Number.isInteger(raw) &&
      raw >= 0 &&
      raw <= (chaos ? CHAOS.maxGoalKmh : GOAL_FEEDBACK.maxKmh)
        ? raw
        : 0;
    if (kmh <= previous) return false;
    localStorage.setItem(key, String(kmh));
    return true;
  } catch {
    return false; // playable without storage; don't claim a persistent record
  }
}
