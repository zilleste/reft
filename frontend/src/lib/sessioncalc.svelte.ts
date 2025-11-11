import { Temporal } from "temporal-polyfill";
import type { BoundedSession, BypassSession } from "./dbTypes";
import { now as reactiveNow } from "./reactiveNow.svelte";
import type { EmaSpec, EmaState } from "./ema";

/**
 * Calculates the total session time up to now. Takes care of duplicate sessions,
 * and ignores parts of sessions that are in the future.
 */
export function totalTime(
  sessions: BoundedSession[],
  now: Temporal.Instant = reactiveNow()
): Temporal.Duration {
  // Convert `now` to epoch milliseconds for comparison math
  const nowMs = now.epochMilliseconds;

  // Normalize sessions to clamped intervals within (-∞, now]
  // and discard any that don't contribute positive duration
  const intervals = sessions
    .map((session) => {
      const endMs = Math.min(session.end, nowMs);
      const startMs = Math.min(session.start, endMs);
      return { start: startMs, end: endMs };
    })
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  if (intervals.length === 0) {
    return Temporal.Duration.from({ milliseconds: 0 });
  }

  // Merge overlapping (and touching) intervals to avoid double counting
  let mergedTotalMs = 0;
  let currentStart = intervals[0].start;
  let currentEnd = intervals[0].end;

  for (let i = 1; i < intervals.length; i++) {
    const { start, end } = intervals[i];
    if (start <= currentEnd) {
      // Overlapping or contiguous; extend the current interval
      if (end > currentEnd) currentEnd = end;
    } else {
      // Disjoint; accumulate and start a new interval
      mergedTotalMs += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    }
  }

  // Add the final interval
  mergedTotalMs += currentEnd - currentStart;

  return Temporal.Duration.from({ milliseconds: mergedTotalMs });
}

type EmaTimeOptions = {
  now?: Temporal.Instant;
  state?: EmaState;
};

/**
 * Computes an exponential moving average over bypass durations.
 * Each bypass contributes its entire duration as a Dirac delta at the bypass end.
 */
export function emaTime(
  bypasses: BypassSession[],
  spec: EmaSpec,
  { now = reactiveNow(), state }: EmaTimeOptions = {}
): EmaState {
  const nowMs = now.epochMilliseconds;
  const baselineMs = state?.at ?? Number.NEGATIVE_INFINITY;

  // Treat `at` as milliseconds for decay calculations. Non-positive durations
  // imply an instantaneous drop for any positive elapsed time.
  const atMs = Math.max(0, spec.at);

  const decayFactor = (elapsedMs: number): number => {
    if (elapsedMs <= 0) return 1;
    if (spec.remaining <= 0) return 0;
    if (spec.remaining >= 1) return 1;
    const normalized = atMs > 0 ? elapsedMs / atMs : Number.POSITIVE_INFINITY;
    return Math.pow(spec.remaining, normalized);
  };

  let amount = state?.amount ?? 0;
  let lastTimestamp = state?.at !== undefined ? state.at : undefined;

  const contributions = bypasses
    .map((session) => {
      const end = Math.min(session.end, nowMs);
      const start = Math.min(session.start, end);
      return { start, end };
    })
    .filter(({ start, end }) => end > start && end > baselineMs && end <= nowMs)
    .sort((a, b) => a.end - b.end);

  for (const { start, end } of contributions) {
    if (lastTimestamp !== undefined) {
      amount *= decayFactor(end - lastTimestamp);
    }
    amount += end - start;
    lastTimestamp = end;
  }

  if (lastTimestamp !== undefined) {
    amount *= decayFactor(nowMs - lastTimestamp);
  }

  return { amount, at: now.epochMilliseconds };
}

/**
 * Returns the currently applicable session.
 * If multiple sessions are active, it picks the one that extends the furthest into the future.
 */
export function currentSession<T extends BoundedSession>(
  sessions: T[],
  now: Temporal.Instant = reactiveNow()
): T | null {
  const nowMs = now.epochMilliseconds;

  // Active when start <= now < end
  const active = sessions.filter((s) => s.start <= nowMs && nowMs < s.end);

  if (active.length === 0) return null;

  // Pick the one extending furthest into the future (max end)
  let best = active[0];
  for (let i = 1; i < active.length; i++) {
    if (active[i].end > best.end) best = active[i];
  }
  return best;
}

/**
 * Returns all sessions that are currently active (start <= now < end).
 */
export function allCurrentSessions<T extends BoundedSession>(
  sessions: T[],
  now: Temporal.Instant = reactiveNow()
): T[] {
  const nowMs = now.epochMilliseconds;
  return sessions.filter((s) => s.start <= nowMs && nowMs < s.end);
}

/**
 * Returns the time left in session, or null if no session is active.
 *
 * This has one crucial behavioral difference from currentSession:
 * It fuses all overlapping / gaplessly joined sessions
 * into one single session, and returns the time left in that session.
 */
export function currentSessionTimeLeft(
  sessions: BoundedSession[],
  now: Temporal.Instant = reactiveNow()
): Temporal.Duration | null {
  const nowMs = now.epochMilliseconds;

  // Normalize and sort intervals (ensure start <= end and positive length)
  const intervals = sessions
    .map((s) => {
      const start = Math.min(s.start, s.end);
      const end = Math.max(s.start, s.end);
      return { start, end };
    })
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  if (intervals.length === 0) return null;

  // Merge overlapping or contiguous intervals
  const merged: { start: number; end: number }[] = [];
  for (const itv of intervals) {
    if (merged.length === 0) {
      merged.push({ ...itv });
      continue;
    }

    const last = merged[merged.length - 1];
    if (itv.start <= last.end) {
      // Overlapping or touching; extend the current interval
      if (itv.end > last.end) last.end = itv.end;
    } else {
      merged.push({ ...itv });
    }
  }

  // Find the merged interval that contains `now`
  for (const m of merged) {
    if (m.start <= nowMs && nowMs < m.end) {
      const msLeft = m.end - nowMs;
      return Temporal.Duration.from({ milliseconds: msLeft });
    }
  }

  return null;
}
