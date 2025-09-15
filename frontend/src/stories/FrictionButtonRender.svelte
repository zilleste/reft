<script lang="ts">
  import type { Snippet } from "svelte";
  import FrictionButton from "$lib/components/FrictionButton.svelte";

  let {
    label = "Click me",
    friction = 0,
  }: { label?: string; friction?: number } = $props();
</script>

<FrictionButton {friction}>
  {label}
</FrictionButton>
