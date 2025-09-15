<script lang="ts">
  import { tick } from "svelte";

  // API
  let {
    value = $bindable(""),
    editable = true,
    placeholder = "??",
  }: {
    value?: string;
    editable?: boolean;
    placeholder?: string;
  } = $props();

  // Local state
  let isEditing = $state(false);
  let inputEl: HTMLInputElement | null = $state(null);
  let measureEl: HTMLSpanElement | null = $state(null);
  let measuredWidth = $state(0);

  const editCols = $derived(() => {
    const vlen = value?.length ?? 0;
    const phlen = placeholder?.length ?? 0;
    return Math.max(1, vlen === 0 ? phlen : vlen);
  });

  export async function edit() {
    if (!editable) return;
    isEditing = true;
    await tick();
    inputEl?.focus();
    inputEl?.select();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      isEditing = false;
    }
  }

  // Measure exact text width to avoid any extra right-side space while editing
  $effect(() => {
    // reference state to trigger re-measure
    const _editing = isEditing;
    const text =
      (value?.length ?? 0) === 0 ? (placeholder ?? "") : (value ?? "");
    // ensure the measure node has the right content
    if (measureEl) {
      measureEl.textContent = text === "" ? " " : text;
      const rect = measureEl.getBoundingClientRect();
      measuredWidth = Math.max(0, rect.width);
    }
  });
</script>

{#if editable}
  <span
    class="inline-flex items-center text-[--color-fg] select-none"
    class:font-editable={editable}
    class:pointer-events-none={!editable}
  >
    {#if isEditing}
      <input
        bind:this={inputEl}
        type="text"
        bind:value
        {placeholder}
        class="bg-transparent outline-none appearance-none border-b border-dotted border-[--color-fg] text-[--color-fg] caret-[--color-fg] px-0 py-0.5 min-w-[1ch] inline-block align-baseline leading-[inherit]"
        size={(value?.length ?? 0) || (placeholder?.length ?? 0) || 1}
        style={`width:${measuredWidth.toFixed(3)}px`}
        onkeydown={onKeydown}
        onblur={() => (isEditing = false)}
      />
    {:else if editable}
      <button
        type="button"
        class="inline-block px-0 py-0.5 min-w-[1ch] bg-transparent text-[--color-fg] appearance-none border-0 align-baseline leading-[inherit] border-b border-dotted border-transparent whitespace-pre cursor-crosshair"
        onclick={() => edit()}
      >
        {#if (value ?? "").length === 0}
          <span class="opacity-50">{placeholder}</span>
        {:else}
          {value}
        {/if}
      </button>
    {/if}
  </span>
{:else}
  <span class="whitespace-pre">
    {value.length === 0 ? placeholder : value}
  </span>
{/if}

<!-- measurement ghost to compute exact width -->
<span
  bind:this={measureEl}
  class="invisible absolute px-0 py-0.5 min-w-[1ch] border-b border-dotted border-transparent whitespace-pre"
  style="position:absolute; left:-99999px; top:-99999px; font: inherit; line-height: inherit;"
></span>
