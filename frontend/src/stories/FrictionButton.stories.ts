import type { Meta, StoryObj } from "@storybook/svelte";
import FrictionButtonRender from "./FrictionButtonRender.svelte";

const meta = {
  title: "Components/FrictionButton",
  component: FrictionButtonRender,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    friction: { control: { type: "number", min: 0, step: 50 } },
  },
  args: {
    label: "Click me",
    friction: 1000,
  },
} satisfies Meta<FrictionButtonRender>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
