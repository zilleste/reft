<script lang="ts">
  import { clamp } from "$lib/mathutil";
  import { now } from "$lib/reactiveNow.svelte";
  import DurationDraggo from "./DurationDraggo.svelte";
  import FrictionButton from "./FrictionButton.svelte";
  import { Temporal } from "temporal-polyfill";

  let {
    onStepAway,
  }: {
    onStepAway: (start: Temporal.Instant, end: Temporal.Instant) => void;
  } = $props();

  let length = $state(Temporal.Duration.from({ seconds: 60 * 60 }));
  let offset = $state(Temporal.Duration.from({ seconds: 0 }));
</script>

<div class="flex flex-col w-42">
  <div class="flex flex-row justify-between">
    <DurationDraggo
      bind:duration={
        () => length,
        (v) =>
          (length = clamp(
            v,
            Temporal.Duration.from({ seconds: 0 }),
            Temporal.Duration.from({ seconds: 60 * 60 * 24 })
          ))
      }
      default={Temporal.Duration.from({ seconds: 60 * 60 })}
      allowNegative={false}
    />
    <DurationDraggo
      bind:duration={
        () => offset,
        (v) =>
          (offset = clamp(
            v,
            Temporal.Duration.from({ seconds: 0 }),
            Temporal.Duration.from({ seconds: 60 * 60 * 6 })
          ))
      }
      prefix="in "
      allowNegative={false}
      zeroText="now"
    />
  </div>
  <div class="h-2" />
  <FrictionButton
    friction={500 +
      (length.total("minutes") + offset.total("minutes")) * (1000 / 30)}
    onactivate={() => {
      onStepAway(now().add(offset), now().add(offset).add(length));
    }}
  >
    Step away
  </FrictionButton>
</div>
