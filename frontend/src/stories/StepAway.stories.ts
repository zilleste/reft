import type { Meta, StoryObj } from "@storybook/svelte";
import StepAwayRender from "./StepAwayRender.svelte";

const meta = {
  title: "Components/StepAway",
  component: StepAwayRender,
  tags: ["autodocs"],
} satisfies Meta<StepAwayRender>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
