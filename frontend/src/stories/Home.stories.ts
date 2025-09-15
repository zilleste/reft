import type { Meta, StoryObj } from "@storybook/svelte";
import HomeRender from "./HomeRender.svelte";
import type { DayState } from "$lib/dbTypes";
import { encrypt } from "$lib/crypto.svelte";
import { keyAfter, rootKey } from "$lib/ordering";

// Helpers
const now = () => Date.now();
const minutesAgo = (m: number) => now() - m * 60_000;
const minutesAfter = (m: number) => now() + m * 60_000;

const avenue = (title: string, desc: string, budgetMinutes: number) => ({
  info: {
    title: encrypt(title),
    description: encrypt(desc),
    budgetMinutes,
    position: keyAfter(rootKey),
  },
  sessions: {
    // Two example sessions today
    s1: {
      start: minutesAgo(120),
      end: minutesAgo(90),
      deviceId: "dev",
    },
    s2: {
      start: minutesAgo(60),
      end: minutesAgo(30),
      deviceId: "dev",
    },
  },
  done: false,
});

const baseDay = (overrides: Partial<DayState> = {}): DayState => ({
  start: minutesAgo(600),
  end: null,
  stepAway: {},
  modeTitle: encrypt("Productive"),
  modeDescription: encrypt(
    "Productive work\n- Coding\n- Writing\n- No new programming projects!"
  ),
  avenues: {
    focus: avenue("Focus", "Heads‑down work", 120),
    play: avenue("Play", "Intentional fun", 45),
  },
  bypasses: {},
  ...overrides,
});

const pastBypasses = () => ({
  b1: { start: minutesAgo(200), end: minutesAgo(180), deviceId: "dev", mode },
  b2: { start: minutesAgo(100), end: minutesAgo(80), deviceId: "dev", mode },
});

const activeStepAway = () => ({
  sa1: { start: minutesAgo(20), end: minutesAfter(20), deviceId: "dev" },
});

const endedMoreThanHourAgo = () => minutesAgo(90);
const endedLessThanHourAgo = () => minutesAgo(30);

const meta = {
  title: "Components/Home",
  component: HomeRender,
  tags: ["autodocs"],
  args: {
    dayState: baseDay(),
  },
} satisfies Meta<HomeRender>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NormalSession: Story = {
  args: {
    dayState: baseDay({
      bypasses: pastBypasses("normal"),
    }),
  },
};

export const StepAwayActive: Story = {
  args: {
    dayState: baseDay({ stepAway: activeStepAway() }),
  },
};

export const ReadyForNextDay: Story = {
  args: {
    dayState: baseDay({ end: endedMoreThanHourAgo() }),
  },
};

export const DayJustEnded: Story = {
  args: {
    dayState: baseDay({ end: endedLessThanHourAgo() }),
  },
};

export const DayEndedAndStepAway: Story = {
  args: {
    dayState: baseDay({ end: minutesAgo(10), stepAway: activeStepAway() }),
  },
};
