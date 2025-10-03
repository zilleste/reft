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
</script>

<div>
  <textarea bind:value={content} oninput={scheduleSave}></textarea>
</div>

<style>
  div {
    width: 100%;
    height: 100%;
  }

  textarea {
    width: 100%;
    height: 100%;
    padding: 2rem;
    resize: none;
  }
</style>
