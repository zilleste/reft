<script lang="ts">
  import { onMount } from "svelte";

  const {
    save,
    goBack,
    contentPromise,
  }: {
    save: (content: string) => void;
    goBack: () => void;
    contentPromise: Promise<string>;
  } = $props();

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let content = $state(await contentPromise);
  let textarea: HTMLTextAreaElement | undefined;
  let selectedWordCount = $state(0);

  function scheduleSave() {
    if (!saveTimeout) {
      saveTimeout = setTimeout(() => {
        save(content);
        saveTimeout = null;
      }, 1000);
    }
  }

  onMount(() => {
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        goBack();
      }
    };
    window.addEventListener("keydown", escapeHandler);
    return () => window.removeEventListener("keydown", escapeHandler);
  });

  function updateSelectionWordCount() {
    if (!textarea) {
      selectedWordCount = 0;
      return;
    }

    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? 0;

    if (selectionStart === selectionEnd) {
      selectedWordCount = 0;
      return;
    }

    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    const selectedText = textarea.value.slice(start, end).trim();

    if (!selectedText) {
      selectedWordCount = 0;
      return;
    }

    const words = selectedText.split(/\s+/).filter(Boolean);
    selectedWordCount = words.length;
  }

  function clearSelectionWordCount() {
    selectedWordCount = 0;
  }
</script>

<div class="notepad">
  <textarea
    bind:this={textarea}
    bind:value={content}
    oninput={scheduleSave}
    onselect={updateSelectionWordCount}
    onkeyup={updateSelectionWordCount}
    onmouseup={updateSelectionWordCount}
    onblur={clearSelectionWordCount}
  ></textarea>

  {#if selectedWordCount > 0}
    <div class="word-counter">
      {selectedWordCount} {selectedWordCount === 1 ? "word" : "words"}
    </div>
  {/if}
</div>

<style>
  .notepad {
    width: 100%;
    height: 100%;
    position: relative;
  }

  textarea {
    width: 100%;
    height: 100%;
    padding: 2rem;
    resize: none;
  }

  .word-counter {
    position: absolute;
    right: 1.5rem;
    bottom: 1.5rem;
    font-size: 0.875rem;
    color: var(--color-amber-300, #fcd34d);
    background: rgba(0, 0, 0, 0.75);
    border-radius: 0.5rem;
    padding: 0.35rem 0.75rem;
    pointer-events: none;
  }
</style>
