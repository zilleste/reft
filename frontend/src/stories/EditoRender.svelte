<script lang="ts">
  import Edito from "$lib/components/Edito.svelte";
  let text = $state("");
  let locked = $state(false);
</script>

<div class="space-y-4 text-amber-300">
  <div class="space-x-2">
    <label class="inline-flex items-center gap-2">
      <input type="checkbox" bind:checked={locked} />
      <span>editable = {!locked}</span>
    </label>
  </div>

  <div>
    <span>yesterday</span>
    <Edito
      bind:value={text}
      editable={!locked}
      placeholder="absolutely nowhere"
    />
    <span>i saw a bird</span>
  </div>

  <style>
    :global(body) {
      background: black;
      font-family: "Monaspace Xenon", ui-monospace, SFMono-Regular, Menlo,
        Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
  </style>
</div>
