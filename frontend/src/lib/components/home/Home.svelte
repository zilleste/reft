<script lang="ts">
  import type { DayState } from "$lib/dbTypes";
  import { Temporal } from "temporal-polyfill";
  import StepAway from "../StepAway.svelte";
  import { decrypt } from "$lib/crypto.svelte";
  import FrictionButton from "../FrictionButton.svelte";
  import {
    areAvenuesAvailable,
    avenueTimeLeft,
    bypassFrictionPerMinute,
    detoxRestrictionsApply,
    isInStepAway,
    nextDayReady,
  } from "./homeUtil";
  import {
    currentSession,
    currentSessionTimeLeft,
    totalTime,
  } from "$lib/sessioncalc.svelte";
  import { clamp } from "$lib/mathutil";
  import { now } from "$lib/reactiveNow.svelte";
  import type { DurationFormatOptions } from "../../../app";

  let {
    dayState,
    onConfig,
    onStepAway,
    onSessionStart,
    onDayEnd,
    onDayEndUndo,
    onBypassStart,
    onAvenueDone,
    onEndCurrentSession,
    onShutdown,
  }: {
    dayState: DayState;
    onConfig: () => void;
    onStepAway: (start: Temporal.Instant, end: Temporal.Instant) => void;
    onSessionStart: (
      avenue: string,
      start: Temporal.Instant,
      end: Temporal.Instant,
      pinned: boolean
    ) => void;
    onBypassStart: (
      start: Temporal.Instant,
      end: Temporal.Instant,
      mode: "normal" | "detox"
    ) => void;
    onDayEndUndo: () => void;
    onDayEnd: () => void;
    onAvenueDone: (avenue: string) => void;
    onEndCurrentSession: () => void;
    onShutdown: () => void;
  } = $props();

  type Item =
    | {
        type: "avenue";
        avenue: string;
      }
    | {
        type: "bypass";
      };

  let hoveredItem = $state<Item | null>(null);

  const items: Item[] = $derived([
    ...(areAvenuesAvailable(dayState)
      ? Object.keys(dayState.avenues)
          .filter(
            (avenue) =>
              !dayState.avenues[avenue].done &&
              avenueTimeLeft(dayState, avenue).total("seconds") > 30
          )
          .map((avenue) => ({
            type: "avenue" as const,
            avenue,
          }))
      : []),
    {
      type: "bypass",
    },
  ]);

  const durationFormat: DurationFormatOptions = {
    style: "narrow",
    hours: "narrow",
    hoursDisplay: "auto",
    minutes: "narrow",
    minutesDisplay: "always",
  };

  const bypasses = $derived(
    Object.values(dayState.bypasses).filter(
      (bypass) =>
        Temporal.Instant.fromEpochMilliseconds(bypass.start)
          .until(now())
          .total("days") < 1
    )
  );

  function itemInfo(item: Item): {
    title: string;
    supplementary: string;
    isHovered: boolean;
  } {
    if (item.type === "avenue") {
      const timeLeft = avenueTimeLeft(dayState, item.avenue);
      return {
        title: decrypt(dayState.avenues[item.avenue].info.title),
        supplementary: timeLeft
          .round({
            largestUnit: "hours",
            smallestUnit: "minutes",
            roundingMode: "floor",
          })
          .toLocaleString("en-US", durationFormat),
        isHovered:
          hoveredItem?.type === "avenue" && hoveredItem.avenue === item.avenue,
      };
    }
    if (item.type === "bypass") {
      const supplementary = `-${totalTime(bypasses)
        .round({
          largestUnit: "hours",
          smallestUnit: "minutes",
          roundingMode: "ceil",
        })
        .toLocaleString("en-US", durationFormat)}`;
      if (isInStepAway(dayState)) {
        return {
          title: "Step away",
          supplementary,
          isHovered: hoveredItem?.type === "bypass",
        };
      } else {
        return {
          title: "Bypass",
          supplementary,
          isHovered: hoveredItem?.type === "bypass",
        };
      }
    }
    return item satisfies never;
  }

  const sessionStarter =
    (avenue: string, duration: Temporal.Duration) => () => {
      onSessionStart(
        avenue,
        now(),
        now().add(duration),
        duration.total("minutes") >= 60
      );
    };

  const bypassStarter = (duration: Temporal.Duration) => () => {
    onBypassStart(
      now(),
      now().add(duration),
      detoxRestrictionsApply(dayState) ? "detox" : "normal"
    );
  };
</script>

<div class="w-full h-full p-4">
  <div
    class="grid grid-cols-2 [grid-template-rows:1fr_2fr] gap-8 w-full h-full"
  >
    <!-- Top-left: align bottom-right (towards center) -->
    <div class="place-self-end justify-self-end">
      <StepAway {onStepAway} />
    </div>

    <!-- Top-right: align bottom-left (towards center) -->
    <div class="place-self-end justify-self-start mb-[-0.77em] relative">
      <div class="select-none cursor-pointer group">
        <span class="text-8xl font-black font-display"
          >{hoveredItem?.type === "avenue"
            ? decrypt(dayState.avenues[hoveredItem.avenue].info.title)
            : dayState.end
              ? "The End"
              : decrypt(dayState.modeTitle)}</span
        >

        <div
          class="absolute bottom-0 left-0 group-hover:opacity-100 opacity-0 bg-black flex flex-col justify-end w-full h-full"
        >
          <div class="flex flex-row gap-2 pb-3">
            {#if !dayState.end}
              <FrictionButton
                friction={1000}
                onactivate={() => {
                  onDayEnd();
                }}>End day</FrictionButton
              >
            {/if}
            {#if dayState.end && !isInStepAway(dayState)}
              <FrictionButton
                friction={1000}
                onactivate={() => {
                  onDayEndUndo();
                }}>Undo end day</FrictionButton
              >
            {/if}
            <FrictionButton
              friction={500}
              onactivate={() => {
                onConfig();
              }}
            >
              {#if nextDayReady(dayState)}
                Start next day
              {:else}
                Edit config
              {/if}
            </FrictionButton>
            <FrictionButton
              friction={2000}
              onactivate={() => {
                onShutdown();
              }}
            >
              Shut down
            </FrictionButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom-left: align top-right (towards center) and scrollable -->
    <div
      class="place-self-start justify-self-stretch self-stretch mt-[-0.4em] flex flex-col"
    >
      {#each items as item}
        {@const { title, supplementary, isHovered } = itemInfo(item)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="self-stretch text-right cursor-pointer select-none h-12 w-full"
          onmouseenter={() => {
            hoveredItem = item;
          }}
          onmouseleave={() => {
            hoveredItem = null;
          }}
        >
          {#if isHovered}
            <div class="flex flex-row gap-2 cursor-none justify-end w-full">
              {#if item.type === "avenue"}
                {@const timeLeft = avenueTimeLeft(dayState, item.avenue)}
                <FrictionButton
                  friction={10000}
                  onactivate={() => {
                    onAvenueDone(item.avenue);
                  }}>&nbsp;Done&nbsp;</FrictionButton
                >
                <FrictionButton
                  friction={10000}
                  onactivate={sessionStarter(item.avenue, timeLeft)}
                  >&nbsp;{timeLeft
                    .round({
                      largestUnit: "hours",
                      smallestUnit: "minutes",
                      roundingMode: "floor",
                    })
                    .toLocaleString(
                      "en-US",
                      durationFormat
                    )}&nbsp;</FrictionButton
                >
                {#if timeLeft.total("minutes") >= 60}
                  <FrictionButton
                    friction={6000}
                    onactivate={sessionStarter(
                      item.avenue,
                      Temporal.Duration.from({ minutes: 45 })
                    )}>&nbsp;45m&nbsp;</FrictionButton
                  >
                {/if}
                {#if timeLeft.total("minutes") >= 30}
                  <FrictionButton
                    friction={2000}
                    onactivate={sessionStarter(
                      item.avenue,
                      Temporal.Duration.from({ minutes: 15 })
                    )}>&nbsp;15m&nbsp;</FrictionButton
                  >
                {/if}
                {#if timeLeft.total("minutes") >= 15}
                  <FrictionButton
                    friction={500}
                    onactivate={sessionStarter(
                      item.avenue,
                      Temporal.Duration.from({ minutes: 3 })
                    )}>&nbsp;3m&nbsp;</FrictionButton
                  >
                {/if}
              {:else if item.type === "bypass"}
                {@const frictionPerMinute = bypassFrictionPerMinute(
                  dayState,
                  bypasses
                )}
                {#if !detoxRestrictionsApply(dayState)}
                  <FrictionButton
                    friction={45 * frictionPerMinute}
                    onactivate={bypassStarter(
                      Temporal.Duration.from({ minutes: 45 })
                    )}>&nbsp;45m&nbsp;</FrictionButton
                  >
                {/if}
                <FrictionButton
                  friction={15 * frictionPerMinute}
                  onactivate={bypassStarter(
                    Temporal.Duration.from({ minutes: 15 })
                  )}>&nbsp;15m&nbsp;</FrictionButton
                >
                <FrictionButton
                  friction={3 * frictionPerMinute}
                  onactivate={bypassStarter(
                    Temporal.Duration.from({ minutes: 3 })
                  )}>&nbsp;3m&nbsp;</FrictionButton
                >
              {/if}
            </div>
          {:else}
            <span class="text-xl">{supplementary}</span>
            <span class="text-2xl font-bold">{title}</span>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Bottom-right: align top-left (towards center) -->
    <div class="place-self-start justify-self-start whitespace-pre-wrap">
      {#if hoveredItem?.type === "avenue"}
        {decrypt(dayState.avenues[hoveredItem.avenue].info.description)}
      {:else if hoveredItem?.type === "bypass"}
        {#if isInStepAway(dayState)}
          {@const timeLeft =
            currentSessionTimeLeft(Object.values(dayState.stepAway)) ??
            Temporal.Duration.from({ milliseconds: 0 })}
          {@const stepAwayUntil = now().add(timeLeft)}
          {#if timeLeft.total("minutes") < 60}
            Step away for {timeLeft.total("minutes").toFixed(0)} minutes
          {:else}
            Step away until {stepAwayUntil.toLocaleString("en-US", {
              timeStyle: "short",
            })}
          {/if}
        {:else}
          Use sparingly!
        {/if}
      {:else if dayState.end}
        {@const timeLeft =
          currentSessionTimeLeft(Object.values(dayState.stepAway)) ??
          Temporal.Duration.from({ milliseconds: 0 })}
        {@const startNextDayAt = clamp(
          now().add(timeLeft),
          Temporal.Instant.fromEpochMilliseconds(dayState.end).add(
            Temporal.Duration.from({ hours: 1 })
          ),
          null
        )}
        {#if now().until(startNextDayAt).total("minutes") < 0}
          Your next day awaits!
        {:else if now().until(startNextDayAt).total("minutes") < 60}
          Goodbye! You can start the next day in {now()
            .until(startNextDayAt)
            .total("minutes")
            .toFixed(0)} minutes.
        {:else}
          Goodbye! You can start the next day at {startNextDayAt.toLocaleString(
            "en-US",
            {
              timeStyle: "short",
            }
          )}
        {/if}
      {:else}
        {decrypt(dayState.modeDescription)}
      {/if}
    </div>
  </div>
</div>
