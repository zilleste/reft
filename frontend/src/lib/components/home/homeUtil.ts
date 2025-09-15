import type { BypassSession, DayState } from "$lib/dbTypes";
import { now } from "$lib/reactiveNow.svelte";
import { currentSession, totalTime } from "$lib/sessioncalc.svelte";
import { Temporal } from "temporal-polyfill";

export function isInStepAway(day: DayState): boolean {
  return currentSession(Object.values(day.stepAway)) !== null;
}

export function detoxRestrictionsApply(day: DayState): boolean {
  if (isInStepAway(day)) {
    return true;
  }
  if (day.isDetox) {
    return true;
  }
  if (day.end) {
    return true;
  }
  return false;
}

export function areAvenuesAvailable(day: DayState): boolean {
  return !day.end && !isInStepAway(day);
}

export function bypassFrictionPerMinute(
  day: DayState,
  bypasses: BypassSession[]
): number {
  const nonDetoxBypassTimeMins = totalTime(
    bypasses.filter((s) => s.mode === "normal")
  ).total("minutes");
  const detoxBypassTimeMins = totalTime(
    bypasses.filter((s) => s.mode === "detox")
  ).total("minutes");
  const totalBypassTimeMins = nonDetoxBypassTimeMins + detoxBypassTimeMins;
  if (detoxRestrictionsApply(day)) {
    return (
      400 *
      (1 +
        nonDetoxBypassTimeMins / 5 +
        detoxBypassTimeMins / 3 +
        Math.pow(detoxBypassTimeMins / 10, 2) +
        Math.pow(detoxBypassTimeMins / 30, 3))
    );
  } else {
    return 200 * (1 + totalBypassTimeMins / 5);
  }
}

export function nextDayReady(day: DayState): boolean {
  if (day.end && !isInStepAway(day)) {
    return (
      Temporal.Instant.fromEpochMilliseconds(day.end)
        .until(now())
        .total("minutes") >= 60
    );
  }
  return false;
}

export function avenueTimeLeft(
  day: DayState,
  avenueId: string
): Temporal.Duration {
  const avenue = day.avenues[avenueId];
  const sessions = Object.values(avenue.sessions);
  const usedTime = totalTime(sessions);
  const budget = Temporal.Duration.from({
    milliseconds: Math.floor(avenue.info.budgetMinutes * 60 * 1000),
  });
  const timeLeft = budget.subtract(usedTime);
  return timeLeft;
}
