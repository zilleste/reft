import type { Meta, StoryObj } from "@storybook/svelte";
import ConfigEditorRender from "./ConfigEditorRender.svelte";

const meta = {
  title: "Components/ConfigEditor",
  component: ConfigEditorRender,
  tags: ["autodocs"],
} satisfies Meta<ConfigEditorRender>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
