#!/usr/bin/env -S pnpm exec tsx

import { $ } from "zx";

await $`pnpm electron:prepare`;
await $`pnpm electron electron/inputs/main.mjs -- --dev`;
