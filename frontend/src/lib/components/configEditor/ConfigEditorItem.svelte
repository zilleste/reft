<script lang="ts">
  import { ChevronRight } from "@lucide/svelte";
  import { scale } from "svelte/transition";
  import { GripVertical } from "@lucide/svelte";

  let {
    children,
    isSelected,
    onClick = () => {},
    onHover = (edge: "top" | "bottom") => {},
    onDrag = (mouseX: number, mouseY: number) => {},
    onDragEnd = () => {},
  }: {
    children: any;
    isSelected: boolean;
    onClick?: () => void;
    onHover?: (edge: "top" | "bottom") => void;
    onDrag?: (mouseX: number, mouseY: number) => void;
    onDragEnd?: () => void;
  } = $props();

  let dragState = $state<{
    distance: number;
    lastMousePos: { x: number; y: number };
  } | null>(null);

  function pointerMoveHandler(e: PointerEvent) {
    onDrag(e.clientX, e.clientY);
    if (dragState !== null) {
      dragState.distance +=
        Math.abs(e.clientX - dragState.lastMousePos.x) +
        Math.abs(e.clientY - dragState.lastMousePos.y);
      dragState.lastMousePos = { x: e.clientX, y: e.clientY };
    }
  }

  function pointerUpHandler() {
    onDragEnd();
    if (dragState !== null && dragState.distance < 10) {
      onClick();
    }
    dragState = null;
    window.removeEventListener("pointermove", pointerMoveHandler);
    window.removeEventListener("pointerup", pointerUpHandler);
  }
</script>

<svelte:boundary
  onerror={(e, reset) => (console.error(e), setTimeout(reset, 1000))}
>
  <div class="w-full h-8 relative select-none shrink-0">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->

    <div
      class="w-full h-full flex flex-row items-center px-4 gap-4"
      class:bg-amber-300={isSelected}
      class:text-black={isSelected}
      style={isSelected ? "--color-fg: black" : ""}
      onpointermove={(e) =>
        onHover(
          e.clientY <
            (e.target as HTMLElement).getBoundingClientRect().top +
              (e.target as HTMLElement).getBoundingClientRect().height / 2
            ? "top"
            : "bottom"
        )}
      onpointerdown={(e) => {
        dragState = {
          distance: 0,
          lastMousePos: { x: e.clientX, y: e.clientY },
        };
        window.addEventListener("pointermove", pointerMoveHandler);
        window.addEventListener("pointerup", pointerUpHandler);
      }}
    >
      {@render children()}
    </div>
  </div>
</svelte:boundary>
