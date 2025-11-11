import { Temporal } from "temporal-polyfill";
import z from "zod";

export const EmaSpec = z.object({
  /**
   * Between 0 and 1.
   * Example: When this is 0.5, "at" describes the half-life.
   */
  remaining: z.number(),
  at: z.number().describe("Milliseconds elapsed."),
});
export type EmaSpec = z.infer<typeof EmaSpec>;

export const EmaState = z.object({
  amount: z.number(),
  at: z.number().describe("Milliseconds since epoch."),
});
export type EmaState = z.infer<typeof EmaState>;

export const EMA_SPEC_BYPASS: EmaSpec = {
  remaining: 0.5,
  at: 24 * 60 * 60 * 1000,
};
