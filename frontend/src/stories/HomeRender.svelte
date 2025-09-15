<script lang="ts">
  import Home from "$lib/components/home/Home.svelte";
  import type { DayState } from "$lib/dbTypes";
  import { Temporal } from "temporal-polyfill";

  let { dayState }: { dayState: DayState } = $props();

  const onConfig = () => {};
  const onDayEndUndo = () => {};
  const onStepAway = (_start: Temporal.Instant, _end: Temporal.Instant) => {};
  const onSessionStart = (
    _avenue: string,
    _start: Temporal.Instant,
    _end: Temporal.Instant
  ) => {};
  const onBypassStart = (
    _start: Temporal.Instant,
    _end: Temporal.Instant,
    _mode: "normal" | "detox"
  ) => {};
</script>

<div class="text-amber-300" style="width: 100vw; height: 100vh">
  <Home
    {dayState}
    {onConfig}
    {onStepAway}
    {onSessionStart}
    {onBypassStart}
    {onDayEndUndo}
  />
</div>

<style>
  :global(#storybook-root) {
    padding: 0 !important;
  }
</style>
