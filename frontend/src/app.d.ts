// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export type DurationFormatOptions = {
  localeMatcher?: "lookup" | "best fit" | undefined;
  numberingSystem?: string | undefined;
  style?: "long" | "short" | "narrow" | "digital" | undefined;
  years?: "long" | "short" | "narrow" | undefined;
  yearsDisplay?: "always" | "auto" | undefined;
  months?: "long" | "short" | "narrow" | undefined;
  monthsDisplay?: "always" | "auto" | undefined;
  weeks?: "long" | "short" | "narrow" | undefined;
  weeksDisplay?: "always" | "auto" | undefined;
  days?: "long" | "short" | "narrow" | undefined;
  daysDisplay?: "always" | "auto" | undefined;
  hours?: "long" | "short" | "narrow" | "numeric" | "2-digit" | undefined;
  hoursDisplay?: "always" | "auto" | undefined;
  minutes?: "long" | "short" | "narrow" | "numeric" | "2-digit" | undefined;
  minutesDisplay?: "always" | "auto" | undefined;
  seconds?: "long" | "short" | "narrow" | "numeric" | "2-digit" | undefined;
  secondsDisplay?: "always" | "auto" | undefined;
  milliseconds?: "long" | "short" | "narrow" | "numeric" | undefined;
  millisecondsDisplay?: "always" | "auto" | undefined;
  microseconds?: "long" | "short" | "narrow" | "numeric" | undefined;
  microsecondsDisplay?: "always" | "auto" | undefined;
  nanoseconds?: "long" | "short" | "narrow" | "numeric" | undefined;
  nanosecondsDisplay?: "always" | "auto" | undefined;
  fractionalDigits?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | undefined;
};

declare module "temporal-polyfill" {
  export namespace Temporal {
    interface Duration {
      /**
       * Override: accept DurationFormatOptions for Intl.DurationFormat-style options
       */
      toLocaleString(
        locales?: Intl.LocalesArgument,
        options?: DurationFormatOptions
      ): string;
    }
  }
}

export {};
