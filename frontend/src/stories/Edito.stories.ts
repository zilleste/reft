import type { Meta, StoryObj } from "@storybook/svelte";
import EditoRender from "./EditoRender.svelte";

const meta = {
  title: "Components/Edito",
  component: EditoRender,
  tags: ["autodocs"],
} satisfies Meta<EditoRender>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};


