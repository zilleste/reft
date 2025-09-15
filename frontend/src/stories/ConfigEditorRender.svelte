<script lang="ts">
  import ConfigEditor from "$lib/components/configEditor/ConfigEditor.svelte";
  import type { PermanentState } from "$lib/dbTypes";
  import { encrypt } from "$lib/crypto.svelte";
  import { keyAfter, rootKey } from "$lib/ordering";

  // Seed demo config
  const demo: PermanentState = {
    baseAvenues: {
      focus: {
        title: encrypt("Focus"),
        description: encrypt("Heads‑down work time"),
        budgetMinutes: 90,
        position: keyAfter(rootKey),
      },
      play: {
        title: encrypt("Play"),
        description: encrypt("Intentional fun"),
        budgetMinutes: 45,
        position: keyAfter(rootKey),
      },
    },
    baseApps: {
      "com.discord": {
        packageName: encrypt("com.discord"),
        displayName: encrypt("Discord"),
      },
      "com.spotify": {
        packageName: encrypt("com.spotify"),
        displayName: encrypt("Spotify"),
      },
    },
    customModes: {
      deepwork: {
        title: encrypt("Deep Work"),
        description: encrypt("Silence almost everything"),
        avenues: {
          deepfocus: {
            title: encrypt("Deep Focus"),
            description: encrypt("No distractions"),
            budgetMinutes: 120,
            position: keyAfter(rootKey),
          },
        },
        position: keyAfter(rootKey),
      },
    },
  };

  let state = $state<PermanentState>(demo);
</script>

<div class="text-amber-300" style="width: 100vw; height: 100vh">
  <ConfigEditor bind:config={state} startDay={() => {}} goBack={() => {}} />
</div>

<style>
  :global(#storybook-root) {
    padding: 0 !important;
  }
</style>
