#!/usr/bin/env -S pnpm exec tsx

import { $ } from "zx";
import { rm, mkdir, cp } from "node:fs/promises";
import { homedir } from "node:os";

await $`pnpm --filter=frontend build`;
await rm("electron/inputs", { recursive: true, force: true });
await mkdir("electron/inputs");
await cp("frontend/build", "electron/inputs/web", {
  recursive: true,
});
await $`pnpm electron:prepare`;
await $`cd electron && pnpm electron-builder --mac`;
try {
  await $`killall Reft`;
  await $`sleep 0.5`;
  await $`killall Reft`;
} catch {}
await $`rm -rf /Applications/Reft.app`;
await $`cp -r electron/dist/mac-arm64/Reft.app /Applications/Reft.app`;
await $`open -n /Applications/Reft.app/`;
