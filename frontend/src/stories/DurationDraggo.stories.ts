import type { Meta, StoryObj } from "@storybook/svelte";
import DurationDraggoRender from "./DurationDraggoRender.svelte";

const meta = {
  title: "Components/DurationDraggo",
  component: DurationDraggoRender,
  tags: ["autodocs"],
} satisfies Meta<DurationDraggoRender>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
