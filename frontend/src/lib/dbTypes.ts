import z from "zod";
import { EncryptedString } from "./crypto.svelte";
import { OrderKey } from "./ordering";

export const UnboundedSession = z.object({
  start: z.number(),
  end: z.number().nullable(),
  deviceId: z.string(),
});
export type UnboundedSession = z.infer<typeof UnboundedSession>;

export const BoundedSession = UnboundedSession.extend({
  end: z.number(),
});
export type BoundedSession = z.infer<typeof BoundedSession>;

export const BypassSession = BoundedSession.extend({
  mode: z.enum(["normal", "detox"]),
});
export type BypassSession = z.infer<typeof BypassSession>;

export const AvenueInfo = z.object({
  title: EncryptedString,
  description: EncryptedString,
  budgetMinutes: z.number(),
  position: OrderKey,
});
export type AvenueInfo = z.infer<typeof AvenueInfo>;

export const App = z.object({
  packageName: EncryptedString,
  displayName: EncryptedString,
});
export type App = z.infer<typeof App>;

export const DayState = z.object({
  start: z.number(),
  end: z.number().nullable(),
  stepAway: z.record(z.string(), BoundedSession),
  modeTitle: EncryptedString,
  modeDescription: EncryptedString,
  avenues: z.record(
    z.string(),
    z.object({
      info: AvenueInfo,
      sessions: z.record(z.string(), BoundedSession),
      done: z.boolean(),
    })
  ),
  bypasses: z.record(z.string(), BypassSession),
});
export type DayState = z.infer<typeof DayState>;

export const CustomMode = z.object({
  title: EncryptedString,
  description: EncryptedString,
  avenues: z.record(z.string(), AvenueInfo),
  position: OrderKey,
});
export type CustomMode = z.infer<typeof CustomMode>;

export const PermanentState = z.object({
  baseAvenues: z.record(z.string(), AvenueInfo),
  baseApps: z.record(z.string(), App),
  customModes: z.record(z.string(), CustomMode),
});
export type PermanentState = z.infer<typeof PermanentState>;
