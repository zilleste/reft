import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, type PluginOption } from "vite";
import mkcert from "vite-plugin-mkcert";
import tailwindcss from "@tailwindcss/vite";

const alwaysReload: PluginOption = {
  name: "always-reload",
  handleHotUpdate({ server }) {
    server.ws.send({ type: "full-reload" });
    return [];
  },
};

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    mkcert({
      hosts: ["localhost", "computer"],
    }),
    alwaysReload,
  ],
  server: {
    port: 18653,
    host: true,
    allowedHosts: ["computer"],
  },
  build: {
    target: "es2024",
    minify: false,
  },
  esbuild: {
    target: "es2024",
  },
  worker: {
    format: "es",
  },
});
