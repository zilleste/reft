<script lang="ts">
  import type { Snippet } from "svelte";
  import Checkmark from "@lucide/svelte/icons/check";
  import { Spring } from "svelte/motion";
  import { dev } from "$app/environment";

  // Props: children + { friction: number }
  let {
    friction: _friction = 1000,
    children,
    onactivate,
  }: {
    friction?: number;
    children?: Snippet;
    onactivate?: () => void;
  } = $props();

  const friction = $derived(dev ? 100 : _friction);

  // interaction state
  let isPressing = $state(false);
  let isLocked = $state(false); // after grace, lock/hide cursor/prevent scroll
  let isActivated = $state(false);
  let disabled = $state(false);
  let progress = $state(0); // 0..1 (only visible after grace)

  // timings
  const GRACE_MS_DEFAULT = 200;
  const postActivateDisableMs = $derived(1000 + friction / 5);

  // internals
  let graceTimer: number | null = null;
  let raf: number | null = null;
  let downAt = 0;
  let lockAt = 0;
  let pointerId: number | null = null;

  // movement threshold during grace to allow scroll/abort
  const MOVE_THRESHOLD_PX = 8;
  let startX = 0;
  let startY = 0;

  // Hover spring toward cursor
  const offset = new Spring({ x: 0, y: 0 }, { stiffness: 0.05, damping: 0.8 });
  const HOVER_RATIO = 0.5; // fraction of vector toward cursor
  const HOVER_MAX_PX = 100; // clamp translation to this many pixels
  let btnEl: HTMLButtonElement;
  let isHovered = $state(false);
  const uid = $props.id();

  function setOffsetToAnchor() {
    offset.set({ x: 0, y: 0 });
  }

  function onPointerEnter(e: PointerEvent) {
    isHovered = true;
    if (isPressing || isActivated) {
      setOffsetToAnchor();
      return;
    }
    updateHoverOffset(e);
  }

  function onPointerLeave() {
    isHovered = false;
    setOffsetToAnchor();
  }

  function onHoverPointerMove(e: PointerEvent) {
    if (isPressing || isActivated) {
      setOffsetToAnchor();
      return;
    }
    updateHoverOffset(e);
  }

  function updateHoverOffset(e: PointerEvent) {
    if (!btnEl) return;
    const rect = btnEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const vx = e.clientX - cx;
    const vy = e.clientY - cy;

    let tx = vx * HOVER_RATIO;
    let ty = vy * HOVER_RATIO;

    const mag = Math.hypot(tx, ty);
    if (mag > HOVER_MAX_PX && mag > 0) {
      const s = HOVER_MAX_PX / mag;
      tx *= s;
      ty *= s;
    }

    tx /= btnEl.clientWidth / btnEl.clientHeight;

    offset.set({ x: tx, y: ty });
  }

  function preventDefault(e: Event) {
    e.preventDefault();
  }

  function cleanupGlobalHandlers() {
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("pointercancel", onPointerCancel, true);
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener(
      "wheel",
      preventDefault as any,
      { capture: true } as any
    );
    window.removeEventListener(
      "touchmove",
      preventDefault as any,
      { capture: true } as any
    );
  }

  function startGraceTimer(graceMs: number) {
    if (graceTimer) window.clearTimeout(graceTimer);
    graceTimer = window.setTimeout(() => {
      if (!isPressing) return;
      isLocked = true;
      lockAt = performance.now();
      window.addEventListener(
        "wheel",
        preventDefault as any,
        { capture: true } as any
      );
      window.addEventListener(
        "touchmove",
        preventDefault as any,
        { capture: true } as any
      );
      tickProgress();
    }, graceMs) as unknown as number;
  }

  function clearGraceTimer() {
    if (graceTimer) {
      window.clearTimeout(graceTimer);
      graceTimer = null;
    }
  }

  function scheduleTickProgress() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tickProgress);
  }

  function tickProgress() {
    if (!isPressing) return;
    const now = performance.now();
    const target = Math.max(0, friction);
    const elapsedFromDown = now - downAt;
    // progress should tick immediately, not only after the grace/lock period
    progress = Math.min(1, elapsedFromDown / target);

    // draw animated glow frame synced with progress and time
    drawGlowFrame(now);

    if (elapsedFromDown >= target) {
      completeActivation();
      return;
    }
    scheduleTickProgress();
  }

  function completeActivation() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    clearGraceTimer();
    cleanupGlobalHandlers();
    isPressing = false;
    isLocked = false;
    progress = 1;
    isActivated = true;
    disabled = true;
    // Keep at anchor while activated
    setOffsetToAnchor();
    try {
      onactivate?.();
    } catch {}

    // reset after a short success window
    window.setTimeout(() => {
      progress = 0;
      isActivated = false;
      disabled = false;
      if (glowCtx && glowCanvas) {
        glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);
      }
    }, postActivateDisableMs);
  }

  function abortPress() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    clearGraceTimer();
    cleanupGlobalHandlers();
    isPressing = false;
    isLocked = false;
    progress = 0;
    if (glowCtx && glowCanvas) {
      glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);
    }
    setOffsetToAnchor();
  }

  function onPointerDown(e: PointerEvent) {
    if (disabled) return;
    if (e.button !== 0) return; // primary only

    // prevent text selection / native behaviors
    e.preventDefault();
    // Snap back to anchor while pressed
    setOffsetToAnchor();

    // capture pointer
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointerId = e.pointerId;

    downAt = performance.now();
    lockAt = downAt + GRACE_MS_DEFAULT;
    startX = e.clientX;
    startY = e.clientY;

    isPressing = true;
    isLocked = false;
    progress = 0;

    // global listeners for release/cancel/move
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerCancel, true);
    window.addEventListener("pointermove", onPointerMove, true);

    // start ticking progress immediately
    tickProgress();

    startGraceTimer(Math.min(GRACE_MS_DEFAULT, Math.max(0, friction)));
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPressing || isLocked) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (dx * dx + dy * dy >= MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) {
      // allow scroll/abort during grace
      abortPress();
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!isPressing) return;
    if (pointerId !== null && e.pointerId !== pointerId) return;
    // ended before completion => abort
    if (isLocked) {
      abortPress();
    } else {
      abortPress();
    }
  }

  function onPointerCancel() {
    if (!isPressing) return;
    abortPress();
  }

  // ---------- Aurora glow (low-res canvas + blur) ----------
  let glowCanvas: HTMLCanvasElement | null = $state(null);
  let glowCtx: CanvasRenderingContext2D | null = null;
  let glowContainer: HTMLDivElement | null = $state(null);

  function clamp(n: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, n));
  }

  function ensureGlowContext() {
    if (glowCanvas && !glowCtx)
      glowCtx = glowCanvas.getContext("2d", { alpha: true });
  }

  function resizeGlowCanvas() {
    if (!glowCanvas || !btnEl) return;
    const rect = glowContainer!.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    // low-res sizing (~1/8th resolution, clamped bounds)
    const lowW = clamp(Math.floor(w / 8), 64, 256);
    const lowH = clamp(Math.floor(h / 8), 24, 128);
    // set canvas intrinsic size to low-res for pixelation
    if (glowCanvas.width !== lowW || glowCanvas.height !== lowH) {
      glowCanvas.width = lowW;
      glowCanvas.height = lowH;
    }
    // match displayed size via CSS (canvas is absolutely positioned)
    glowCanvas.style.width = `${w}px`;
    glowCanvas.style.height = `${h}px`;
  }

  function drawGlowFrame(now: number) {
    if (!glowCanvas || !btnEl) return;
    ensureGlowContext();
    if (!glowCtx) return;

    resizeGlowCanvas();
    const w = glowCanvas.width;
    const h = glowCanvas.height;

    // progress gate from left to right
    const maxX = Math.floor(w * Math.pow(clamp(progress * 1.05, 0, 1), 0.8));

    const img = glowCtx.createImageData(w, h);
    const data = img.data;

    // Two horizontal smooth-noise rows (top/bottom), per-column vertical gradient between them
    const t = now * 0.0015; // time scaling
    const TAU = Math.PI * 2;

    const topRow: number[] = new Array(w);
    const botRow: number[] = new Array(w);

    for (let x = 0; x < w; x++) {
      const u = x / Math.max(1, w - 1);
      // top row fBm (smooth sine octaves)
      let nTop = 0;
      nTop += Math.sin((u * 2.5 + t * 0.15) * TAU) * 0.55;
      nTop += Math.sin((u * 6.0 - t * 0.1 + 0.7) * TAU) * 0.3;
      nTop += Math.sin((u * 12.0 + t * 0.05 + 2.4) * TAU) * 0.15;
      nTop = 0.5 + 0.5 * nTop;

      // bottom row fBm with different phases/freqs
      let nBot = 0;
      nBot += Math.sin((u * 2.0 - t * 0.12 + 1.3) * TAU) * 0.55;
      nBot += Math.sin((u * 5.4 + t * 0.09 + 3.1) * TAU) * 0.3;
      nBot += Math.sin((u * 10.0 - t * 0.04 + 4.8) * TAU) * 0.15;
      nBot = 0.5 + 0.5 * nBot;

      topRow[x] = clamp(nTop * 0.9 + 0.1, 0, 1);
      botRow[x] = clamp(nBot * 0.9 + 0.1, 0, 1);
    }

    for (let y = 0; y < h; y++) {
      const v = y / Math.max(1, h - 1);
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (x > maxX) {
          data[i + 3] = 0;
          continue;
        }

        // Vertical interpolation between top/bottom rows
        const base = topRow[x] * (1 - v) + botRow[x] * v;

        // Leading-edge feather
        const edge = clamp((maxX - x) / (w * 0.18), 0, 1);

        // Micro-grain to avoid banding
        const micro =
          Math.sin(x * 2.1 + t * 5.0) * Math.sin(y * 3.7 + t * 3.3) * 0.06;

        // Gentle vertical mask (soft center)
        const center = Math.exp(-Math.pow((v - 0.5) * 2.2, 2));

        let brightness =
          base * (0.55 + 0.45 * edge) * (0.75 + 0.25 * center) + micro;
        brightness = clamp(brightness, 0, 1);

        // amber tint around #f59e0b
        const R = 245,
          G = 158,
          B = 11;
        data[i] = Math.floor(R * brightness);
        data[i + 1] = Math.floor(G * brightness);
        data[i + 2] = Math.floor(B * (0.6 + 0.4 * brightness));
        data[i + 3] = Math.floor(255 * brightness);
      }
    }

    glowCtx.putImageData(img, 0, 0);
  }
</script>

<div class="relative select-none">
  <div
    class="absolute -left-16 -top-16 -right-16 -bottom-16 select-none pointer-events-none"
    aria-hidden="true"
  >
    <div
      bind:this={glowContainer}
      class="absolute left-12 right-12 bottom-12 top-12 rounded-2xl overflow-hidden transition-transform duration-500"
      style={`filter: blur(32px) saturate(3) brightness(3) hue-rotate(${progress * 30}deg);`}
      class:scale-0={disabled}
    >
      <canvas
        class="absolute w-full h-full pointer-events-none"
        bind:this={glowCanvas}
        style="image-rendering: pixelated;"
        aria-hidden="true"
      ></canvas>
    </div>

    <svg
      class="fixed left-0 top-0 right-0 bottom-0 w-full h-full z-0 pointer-events-none"
      aria-hidden="true"
      style={`mix-blend-mode: multiply;`}
      class:hidden={disabled || !isPressing}
    >
      <filter
        id={`fb-noise-${uid}`}
        x="0"
        y="0"
        width="100%"
        height="100%"
        filterUnits="objectBoundingBox"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves="2"
          seed="7"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        filter={`url(#fb-noise-${uid})`}
      />
    </svg>
  </div>

  <button
    type="button"
    class={`absolute top-0 left-0 right-0 bottom-0 inline-flex items-center justify-center select-none ring-amber-300 text-amber-300 border-amber-300 ${disabled ? "bg-amber-300 text-black" : "bg-black"} tracking-wide transition-[border-radius,scale,box-shadow] disabled:cursor-not-allowed overflow-visible duration-200 hover:!cursor-none uppercase font-bold ring-2 ${isPressing ? "border-1 rounded-xl scale-98 !cursor-none" : "rounded-none border-4"} ${isHovered && !disabled && !isPressing && !isActivated ? "ring-0 ring-offset-4 ring-offset-black" : "ring-offset-[-2px] ring-offset-black"}`}
    data-friction={friction}
    {disabled}
    bind:this={btnEl}
    onpointerdown={onPointerDown}
    onpointerenter={onPointerEnter}
    onpointermove={onHoverPointerMove}
    onpointerleave={onPointerLeave}
    oncontextmenu={(e) => e.preventDefault()}
    style={`transform: translate(${offset.current.x.toFixed(2)}px, ${offset.current.y.toFixed(2)}px); will-change: transform;`}
  >
    <span
      class="absolute left-0 top-0 bottom-0 right-0 z-10 flex items-center justify-center"
      class:opacity-0={!isPressing || isActivated}
    >
      {Math.round(progress * 100)}%
    </span>

    <span
      class="absolute left-0 top-0 bottom-0 right-0 z-10 flex items-center justify-center"
      class:opacity-0={!isActivated}
    >
      DONE!
    </span>

    <span class="relative z-10" class:opacity-0={isActivated || isPressing}>
      {@render children?.()}
    </span>
  </button>

  <div
    aria-hidden="true"
    class="inline-flex items-center justify-center px-4 py-2 font-bold opacity-0 select-none pointer-events-none"
  >
    <span class="relative z-10" class:opacity-0={isActivated || isPressing}>
      {@render children?.()}
    </span>
  </div>
</div>

<style>
  /* Global lock state while holding after grace period */
  :global(body.friction-lock) {
    touch-action: none !important;
    user-select: none !important;
  }
  /* Immediately hide cursor on press, without locking interactions */
  :global(body.friction-hide-cursor) {
    cursor: pointer !important;
  }
</style>
