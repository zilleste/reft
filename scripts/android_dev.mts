#!/usr/bin/env -S pnpm exec tsx

import { $ } from "zx";

$.env.ENV = "development";
await $`pnpm --filter=frontend sync`;
await $`cd android && ./gradlew installDebug && adb -d shell am start -n com.albegger.opalmini.debug/com.albegger.opalmini.MainActivity`;
