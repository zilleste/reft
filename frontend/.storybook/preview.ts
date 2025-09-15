import type { Preview } from "@storybook/sveltekit";
import "../src/app.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      options: {
        black: { name: "Black", value: "#000" },
      },
    },
    layout: "centered",
  },
  initialGlobals: {
    backgrounds: { value: "Black" },
  },
};

export default preview;
