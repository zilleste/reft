<script lang="ts">
  import { onMount, tick } from "svelte";

  let {
    value = "",
    onDrag,
    onEdit,
    onReset,
  }: {
    value?: string;
    onDrag?: (delta: number) => void;
    onEdit?: (value: string) => void;
    onReset?: () => void;
  } = $props();

  // UI state
  let isDragging = $state(false);
  let isEditing = $state(false);
  let localValue = $state(value);
  let isPointerLocked = $state(false);
  let pointerType: string | null = null;

  // Ensure the input stays inline and only as wide as its contents
  let editCols = $derived(Math.max(3, (localValue?.length ?? 0) || 1));

  // tap/drag heuristic for touch
  const MOVE_THRESHOLD_PX = 6;
  const DBLCLICK_MS = 300;
  const CLICK_MAX_MS = 250; // presses longer than this won't count as clicks
  let startY = 0;
  let lastY = 0;
  let downAt = 0;
  let moved = false;
  let pointerId: number | null = null;
  let lastClick = 0; // timestamp of last primary click (no-drag) up

  let rootEl: HTMLSpanElement | null = $state(null);
  let inputEl: HTMLInputElement | null = $state(null);

  // keep localValue in sync unless actively editing
  $effect(() => {
    if (!isEditing) localValue = value ?? "";
  });

  function setBodyDragClasses(active: boolean) {
    const b = document.body;
    if (active) {
      b.classList.add("draggo-dragging");
    } else {
      b.classList.remove("draggo-dragging");
    }
  }

  function requestLock(target?: Element | null) {
    try {
      // Only attempt on non-touch
      if (pointerType !== "touch") {
        const el = (target as any) ?? (rootEl as any) ?? (document.body as any);
        el?.requestPointerLock?.();
      }
    } catch {}
  }

  function releaseLock() {
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    } catch {}
  }

  function onPointerLockChange() {
    isPointerLocked = !!document.pointerLockElement;
    if (!isPointerLocked && isDragging && pointerType !== "touch") {
      // Lock was lost => finish drag
      finishDrag();
    }
  }

  onMount(() => {
    document.addEventListener("pointerlockchange", onPointerLockChange);
    return () => {
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      cleanupGlobal();
      setBodyDragClasses(false);
    };
  });

  function preventDefault(e: Event) {
    e.preventDefault();
  }

  function startDrag(e: PointerEvent) {
    e.stopPropagation();
    if (isEditing) return;
    const firesTouch = !!(e as any).sourceCapabilities?.firesTouchEvents;
    pointerType =
      e.pointerType === "touch" || firesTouch
        ? "touch"
        : e.pointerType || "mouse";

    // Ignore non-primary mouse buttons (e.g., right-click)
    if (pointerType !== "touch" && e.button !== 0) return;
    // Treat ctrl+click (Mac right-click alias) as context — don't start drag
    if (pointerType !== "touch" && e.button === 0 && e.ctrlKey) return;

    // Detect double-click (desktop primary mouse)
    if (pointerType !== "touch" && e.button === 0) {
      const now = performance.now();
      if (now - lastClick < DBLCLICK_MS) {
        onReset?.();
        // prevent selection/context
        e.preventDefault();
        return;
      }
    }

    // prevent selection and native behaviors on press
    e.preventDefault();
    e.stopPropagation();
    downAt = performance.now();
    startY = e.clientY;
    lastY = e.clientY;
    moved = false;
    isDragging = true;
    pointerId = e.pointerId;

    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onCancel, true);

    if (pointerType === "touch") {
      window.addEventListener(
        "touchmove",
        preventDefault as any,
        {
          capture: true,
          passive: false,
        } as any
      );
    } else {
      requestLock(e.currentTarget as Element);
    }

    setBodyDragClasses(true);
  }

  function onMove(e: PointerEvent) {
    if (!isDragging) return;
    if (pointerId !== null && e.pointerId !== pointerId) return;

    let dy = 0;
    // When pointer locked, MouseEvent has movementY
    if (document.pointerLockElement && pointerType !== "touch") {
      dy = (e as MouseEvent).movementY || 0;
      if (!moved && dy !== 0) {
        moved = true;
        lastClick = 0;
      }
    } else {
      dy = e.clientY - lastY;
      lastY = e.clientY;
    }

    if (!moved) {
      const dist2 = (e.clientY - startY) * (e.clientY - startY);
      if (dist2 >= MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) {
        moved = true;
        // any movement turns this into a drag — cancel pending click timing
        lastClick = 0;
      }
    }

    let speed = 1;
    if (e.shiftKey) speed *= 0.2; // slow
    if (e.metaKey) speed *= 5; // fast (command)

    const delta = -dy * speed;
    if (delta !== 0) onDrag?.(delta);
  }

  function finishDrag() {
    cleanupGlobal();
    isDragging = false;
    setBodyDragClasses(false);
  }

  function onUp(e: PointerEvent) {
    if (!isDragging) return;
    if (pointerId !== null && e.pointerId !== pointerId) return;
    const wasMoved = moved;
    finishDrag();

    // remember primary up time for double-click detection if it was a click
    const now = performance.now();
    const pressMs = now - downAt;
    if (
      pointerType !== "touch" &&
      e.button === 0 &&
      !wasMoved &&
      pressMs <= CLICK_MAX_MS
    ) {
      lastClick = now;
    } else {
      // ended a drag — ensure we don't interpret the next click as a double-click
      lastClick = 0;
    }

    // Tap on mobile to enter edit mode
    if (pointerType === "touch" && !wasMoved) {
      enterEditMode();
    }
  }

  function onCancel() {
    if (!isDragging) return;
    finishDrag();
  }

  function cleanupGlobal() {
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", onUp, true);
    window.removeEventListener("pointercancel", onCancel, true);
    window.removeEventListener(
      "touchmove",
      preventDefault as any,
      {
        capture: true,
      } as any
    );
    releaseLock();
    pointerId = null;
  }

  async function enterEditMode() {
    isEditing = true;
    await tick();
    inputEl?.focus();
    inputEl?.select();
  }

  function confirmEdit() {
    isEditing = false;
    onEdit?.(localValue);
  }

  function cancelEdit() {
    localValue = value ?? "";
    isEditing = false;
  }

  function onKeydownInput(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  function onContextMenu(e: MouseEvent) {
    // Enter edit mode on right-click (desktop). Prevent native menu.
    e.preventDefault();
    e.stopPropagation();
    if (isDragging) return;
    if (!isEditing) enterEditMode();
  }

  // Double-click handled via timing around pointerup/pointerdown
</script>

<span
  bind:this={rootEl}
  class="inline-flex items-center font-editable select-none"
>
  {#if isEditing}
    <input
      bind:this={inputEl}
      type="text"
      bind:value={localValue}
      class="bg-transparent outline-none border-b border-dotted border-[--color-fg] caret-[--color-fg] px-0 py-0.5 min-w-[3ch] w-auto inline-block"
      size={editCols}
      onkeydown={onKeydownInput}
      onblur={confirmEdit}
    />
  {:else}
    <span
      role="button"
      tabindex="0"
      title="Drag up/down. Shift = slow, Cmd/Ctrl = fast. Double‑click to reset. Right‑click to edit."
      class="cursor-ns-resize inline-block border-b border-dotted border-transparent px-0 py-0.5 min-w-[3ch]"
      oncontextmenu={onContextMenu}
      onpointerdown={startDrag}
    >
      {value}
    </span>
  {/if}
</span>

<style>
  :global(body.draggo-dragging) {
    cursor: none !important;
    user-select: none !important;
    -webkit-user-select: none !important;
    touch-action: none !important;
  }
</style>
