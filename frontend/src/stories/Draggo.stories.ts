import type { Meta, StoryObj } from "@storybook/svelte";
import DraggoRender from "./DraggoRender.svelte";

const meta = {
  title: "Components/Draggo",
  component: DraggoRender,
  tags: ["autodocs"],
  argTypes: {
    value: { control: "text" },
  },
  args: {
    value: "42",
  },
} satisfies Meta<DraggoRender>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
