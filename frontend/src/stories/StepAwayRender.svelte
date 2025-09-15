<script lang="ts">
  import StepAway from "$lib/components/StepAway.svelte";
  import { Temporal } from "temporal-polyfill";
</script>

<div class="space-y-4 text-amber-300">
  <StepAway />
  <style>
    :global(body) {
      background: black;
      font-family: "Monaspace Xenon", ui-monospace, SFMono-Regular, Menlo,
        Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
  </style>
</div>
