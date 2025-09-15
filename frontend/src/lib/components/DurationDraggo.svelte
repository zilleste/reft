<script lang="ts">
  import { Temporal } from "temporal-polyfill";
  import Draggo from "./Draggo.svelte";

  let {
    duration = $bindable(Temporal.Duration.from({ seconds: 0 })),
    // "default" is reserved, so capture and rename
    default: defaultDuration = Temporal.Duration.from({ seconds: 0 }),
    prefix = null as string | null,
    zeroText = null as string | null,
    allowNegative = false,
  }: {
    duration?: Temporal.Duration;
    default?: Temporal.Duration;
    prefix?: string | null;
    zeroText?: string | null;
    allowNegative?: boolean;
  } = $props();

  if (
    duration.milliseconds !== 0 ||
    duration.microseconds !== 0 ||
    duration.nanoseconds !== 0 ||
    duration.minutes !== 0 ||
    duration.hours !== 0 ||
    duration.days !== 0 ||
    duration.weeks !== 0 ||
    duration.months !== 0 ||
    duration.years !== 0
  ) {
    console.error(
      "DurationDraggo duration may not contain units other than seconds!",
      duration
    );
    throw new Error(
      "DurationDraggo duration may not contain units other than seconds!"
    );
  }

  if (
    defaultDuration.milliseconds !== 0 ||
    defaultDuration.microseconds !== 0 ||
    defaultDuration.nanoseconds !== 0 ||
    defaultDuration.minutes !== 0 ||
    defaultDuration.hours !== 0 ||
    defaultDuration.days !== 0 ||
    defaultDuration.weeks !== 0 ||
    defaultDuration.months !== 0 ||
    defaultDuration.years !== 0
  ) {
    console.error(
      "DurationDraggo default duration may not contain units other than seconds!",
      defaultDuration
    );
    throw new Error(
      "DurationDraggo default duration may not contain units other than seconds!"
    );
  }

  const ZERO = Temporal.Duration.from({ seconds: 0 });

  let carrySeconds = $state(0); // accumulate fractional seconds between drag frames

  function isZero(d: Temporal.Duration) {
    return Temporal.Duration.compare(d, ZERO) === 0;
  }

  function roundedDisplay(d: Temporal.Duration): { text: string } {
    if (isZero(d)) {
      const z = zeroText ?? "0m";
      return { text: z };
    }

    // work in whole seconds
    let sec = Math.round(d.total({ unit: "seconds" }));
    const negative = sec < 0;
    sec = Math.abs(sec);

    let body: string;
    if (sec >= 86400) {
      // days + hours (rounded to hours)
      let days = Math.floor(sec / 86400);
      let hours = Math.round((sec - days * 86400) / 3600);
      if (hours === 24) {
        days += 1;
        hours = 0;
      }
      body = `${days}d ${hours}h`;
    } else if (sec >= 3600) {
      // hours + minutes (rounded to minutes)
      let hours = Math.floor(sec / 3600);
      let minutes = Math.round((sec - hours * 3600) / 60);
      if (minutes === 60) {
        hours += 1;
        minutes = 0;
      }
      body = `${hours}h ${minutes}m`;
    } else {
      // minutes only (rounded)
      const minutes = Math.round(sec / 60);
      body = `${minutes}m`;
    }

    const sign = negative ? "-" : "";
    const text = prefix ? `${prefix}${sign}${body}` : `${sign}${body}`;
    return { text };
  }

  function addSeconds(d: Temporal.Duration, sec: number) {
    // Only integer seconds to avoid floating drift in Temporal
    const whole = sec < 0 ? Math.ceil(sec) : Math.floor(sec);
    if (whole === 0) return d;
    let next = d.add(Temporal.Duration.from({ seconds: whole }));
    if (!allowNegative && Temporal.Duration.compare(next, ZERO) < 0) {
      next = ZERO;
    }
    return next;
  }

  function stepSecPerPxForMagnitude(minutesAbs: number): number {
    if (minutesAbs < 60) return 1.5;
    if (minutesAbs < 24 * 60) return 6;
    return 120;
  }

  function handleDrag(deltaPixels: number) {
    const s = Math.sign(deltaPixels);
    if (s === 0) return;

    const minutesAbs = Math.abs(duration.total({ unit: "minutes" }));
    const secPerPx = stepSecPerPxForMagnitude(minutesAbs);

    const deltaSeconds = s * Math.abs(deltaPixels) * secPerPx;

    // accumulate fractional seconds across frames
    carrySeconds += deltaSeconds;
    const apply =
      carrySeconds < 0 ? Math.ceil(carrySeconds) : Math.floor(carrySeconds);
    carrySeconds -= apply;
    if (apply !== 0) {
      const next = addSeconds(duration, apply);
      if (
        !allowNegative &&
        Temporal.Duration.compare(next, ZERO) === 0 &&
        apply < 0
      ) {
        carrySeconds = 0;
      }
      duration = next;
    }
  }

  function parseInput(input: string): Temporal.Duration | null {
    let s = input.trim().toLowerCase();
    if (prefix && s.startsWith(prefix.toLowerCase())) {
      s = s.slice(prefix.length).trimStart();
    }
    if (zeroText && s === zeroText.toLowerCase()) return ZERO;

    // Accept forms like "90", "90m", "1.5h", "2d", "1h 30m", "-2h", "+3d"
    const re = /([+-]?\d+(?:\.\d+)?)\s*(d|h|m)?/g;
    let m: RegExpExecArray | null;
    let totalMinutes = 0;
    let matchedAnything = false;
    while ((m = re.exec(s)) !== null) {
      const num = Number(m[1]);
      const unit = (m[2] ?? "m") as "d" | "h" | "m";
      if (!Number.isFinite(num)) continue;
      matchedAnything = true;
      if (unit === "d") totalMinutes += num * 1440;
      else if (unit === "h") totalMinutes += num * 60;
      else totalMinutes += num;
    }
    if (!matchedAnything) return null;
    const seconds = Math.round(totalMinutes * 60);
    return Temporal.Duration.from({ seconds });
  }

  function handleEdit(v: string) {
    const d = parseInput(v);
    if (d)
      duration =
        !allowNegative && Temporal.Duration.compare(d, ZERO) < 0 ? ZERO : d;
  }

  function handleReset() {
    duration =
      !allowNegative && Temporal.Duration.compare(defaultDuration, ZERO) < 0
        ? ZERO
        : defaultDuration;
  }

  const display = $derived(roundedDisplay(duration).text);
</script>

<span
  class="inline-flex items-center font-[Monaspace_Xenon,monospace] select-none"
>
  <Draggo
    value={display}
    onDrag={handleDrag}
    onEdit={handleEdit}
    onReset={handleReset}
  />
  <style>
    :global(body.draggo-dragging) {
      cursor: none !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      touch-action: none !important;
    }
  </style>
</span>
