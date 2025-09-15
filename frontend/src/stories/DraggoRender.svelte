<script lang="ts">
  import Draggo from "$lib/components/Draggo.svelte";

  let {
    value = "42",
  }: {
    value?: string;
  } = $props();

  let current = $state(value);
  let log: string[] = $state([]);

  function pushLog(s: string) {
    log = [s, ...log].slice(0, 8);
  }

  function onDrag(delta: number) {
    // simple demo: parse number and increment
    const n = Number(current);
    if (!Number.isNaN(n)) {
      const next = n + delta;
      current = String(Math.round(next * 100) / 100);
    }
    pushLog(`drag Δ=${delta.toFixed(2)}`);
  }

  function onEdit(v: string) {
    current = v;
    pushLog(`edit → ${v}`);
  }

  function onReset() {
    current = value;
    pushLog("reset");
  }
</script>

<div class="space-y-4 text-amber-300">
  <div class="text-sm opacity-80">
    Draggo demo (drag, shift/ctrl/cmd, dbl‑click, right‑click)
  </div>
  <div class="text-2xl">
    <Draggo value={current} {onDrag} {onEdit} {onReset} />
  </div>
  <div class="text-xs opacity-70">
    Value: {current}
  </div>
  <ul class="text-xs opacity-60 list-disc pl-5">
    {#each log as item}
      <li>{item}</li>
    {/each}
  </ul>
  <div class="text-xs opacity-60">
    Tip: On mobile, tap to edit. On desktop, right‑click to edit.
  </div>
  <style>
    :global(body) {
      background: black;
      font-family: "Monaspace Xenon", ui-monospace, SFMono-Regular, Menlo,
        Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
  </style>
</div>
