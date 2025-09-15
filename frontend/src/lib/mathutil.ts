import { Temporal } from "temporal-polyfill";

// Overloads: clamp numbers or Temporal.Duration values. Mixing types is not allowed.
export function clamp(
  value: number,
  min: number | null,
  max: number | null
): number;
export function clamp(
  value: Temporal.Duration,
  min: Temporal.Duration | null,
  max: Temporal.Duration | null
): Temporal.Duration;

export function clamp(
  value: Temporal.Instant,
  min: Temporal.Instant | null,
  max: Temporal.Instant | null
): Temporal.Instant;

export function clamp(
  value: number | Temporal.Duration | Temporal.Instant,
  min: number | Temporal.Duration | Temporal.Instant | null,
  max: number | Temporal.Duration | Temporal.Instant | null
): number | Temporal.Duration | Temporal.Instant {
  if (typeof value === "number") {
    if (
      !(
        (typeof min === "number" || min === null) &&
        (typeof max === "number" || max === null)
      )
    ) {
      throw new TypeError(
        "clamp: All arguments must be either numbers, Temporal.Duration, or Temporal.Instant, and of the same type."
      );
    }

    let val = value as number;
    if (min !== null) {
      val = Math.max(min, val);
    }
    if (max !== null) {
      val = Math.min(max, val);
    }
    return val;
  } else if (value instanceof Temporal.Duration) {
    if (
      !(
        (min instanceof Temporal.Duration || min === null) &&
        (max instanceof Temporal.Duration || max === null)
      )
    ) {
      throw new TypeError(
        "clamp: All arguments must be either numbers, Temporal.Duration, or Temporal.Instant, and of the same type."
      );
    }

    const v = value as Temporal.Duration;
    const minD = min as Temporal.Duration | null;
    const maxD = max as Temporal.Duration | null;

    if (maxD !== null && Temporal.Duration.compare(v, maxD) > 0) return maxD;
    if (minD !== null && Temporal.Duration.compare(v, minD) < 0) return minD;
    return v;
  } else if (value instanceof Temporal.Instant) {
    if (
      !(
        (min instanceof Temporal.Instant || min === null) &&
        (max instanceof Temporal.Instant || max === null)
      )
    ) {
      throw new TypeError(
        "clamp: All arguments must be either numbers, Temporal.Duration, or Temporal.Instant, and of the same type."
      );
    }

    const v = value as Temporal.Instant;
    const minI = min as Temporal.Instant | null;
    const maxI = max as Temporal.Instant | null;

    if (maxI !== null && Temporal.Instant.compare(v, maxI) > 0) return maxI;
    if (minI !== null && Temporal.Instant.compare(v, minI) < 0) return minI;
    return v;
  } else {
    throw new TypeError(
      "clamp: Unsupported type. All arguments must be either numbers, Temporal.Duration, or Temporal.Instant, and of the same type."
    );
  }
}
