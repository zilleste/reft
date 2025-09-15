<script lang="ts">
  import DurationDraggo from "$lib/components/DurationDraggo.svelte";
  import { Temporal } from "temporal-polyfill";

  let start = Temporal.Duration.from({ minutes: 42 });
  let d = $state(start);
  let prefix = "";
  let zeroText = "awesome";
</script>

<div class="space-y-4 text-amber-300">
  <div class="text-sm opacity-80">DurationDraggo demo</div>
  <div class="text-2xl">
    <DurationDraggo bind:duration={d} {prefix} {zeroText} default={start} />
  </div>
  <div class="text-xs opacity-70">Duration (ISO): {d.toString()}</div>
  <style>
    :global(body) {
      background: black;
      font-family: "Monaspace Xenon", ui-monospace, SFMono-Regular, Menlo,
        Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
  </style>
</div>
