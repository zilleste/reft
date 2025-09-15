#!/usr/bin/env -S pnpm exec tsx

import { $ } from "zx";

$.env.ENV = "production";
await $`pnpm --filter=frontend build`;
await $`pnpm --filter=frontend sync`;
await $`cd android && ./gradlew assembleRelease`;
await $`cd android/app/build/outputs/apk/release && ~/Library/Android/sdk/build-tools/35.0.0/apksigner sign --ks \"${process.env.OPAL_KEYSTORE_PATH}\" --ks-pass env:OPAL_KEYSTORE_PASS --v3-signing-enabled true app-release-unsigned.apk`;
await $`adb -d install app-release-unsigned.apk`;
await $`adb -d shell am start -n com.albegger.opalmini/.MainActivity`;
