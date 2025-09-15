<script lang="ts">
  import { decrypt, encrypt, type EncryptedString } from "$lib/crypto.svelte";
  import type { AvenueInfo, CustomMode } from "$lib/dbTypes";
  import {
    comparer,
    keyAfter,
    keyBefore,
    keyBetween,
    rootKey,
  } from "$lib/ordering";
  import { flip } from "svelte/animate";
  import ConfigEditorItem from "./ConfigEditorItem.svelte";
  import Edito from "../Edito.svelte";
  import ConfigEditorDivider from "./ConfigEditorDivider.svelte";
  import autosizeAction from "svelte-autosize";
  import { enhance } from "$app/forms";
  import autosize from "svelte-autosize";
  import { onMount, tick } from "svelte";
  import { Trash } from "@lucide/svelte";
  import DurationDraggo from "../DurationDraggo.svelte";
  import { Temporal } from "temporal-polyfill";

  let {
    baseAvenues = $bindable(),
    customMode = $bindable(),
  }: {
    baseAvenues: Record<string, AvenueInfo>;
    customMode?: CustomMode;
  } = $props();

  type Item =
    | {
        type: "base_avenue" | "custom_avenue";
        avenue: string;
      }
    | {
        type: "base_custom_divider";
      }
    | {
        type: "add_avenue";
      };

  let selectedItem = $state<Item | null>(null);

  let hoveredItem = $state<[Item, "top" | "bottom"] | null>(null);

  const sortedBaseAvenues = $derived(
    Object.entries(baseAvenues).sort(comparer(([k, v]) => v.position))
  );

  const sortedCustomAvenues = $derived(
    customMode
      ? Object.entries(customMode.avenues).sort(
          comparer(([k, v]) => v.position)
        )
      : []
  );

  const items: Item[] = $derived([
    ...sortedBaseAvenues.map(([key, avenue]) => ({
      type: "base_avenue" as const,
      avenue: key,
    })),
    ...(customMode
      ? [
          { type: "base_custom_divider" as const },
          ...sortedCustomAvenues.map(([key, avenue]) => ({
            type: "custom_avenue" as const,
            avenue: key,
          })),
        ]
      : []),
    { type: "add_avenue" as const },
  ]);

  let descriptionTextarea: HTMLTextAreaElement | null = $state(null);

  onMount(() => {
    tick().then(() => {
      if (descriptionTextarea) {
        autosize.update(descriptionTextarea);
      }
    });
  });

  $effect(() => {
    if (customMode?.description && descriptionTextarea) {
      autosize.update(descriptionTextarea);
    }
  });

  let moveAcrossDebounced = $state<string | null>(null);

  function dragAvenue(isBase: boolean, id: string, item: AvenueInfo) {
    if (hoveredItem) {
      function flip(targetIdx: number) {
        if (
          (selectedItem?.type === "base_avenue" ||
            selectedItem?.type === "custom_avenue") &&
          selectedItem?.avenue === id
        ) {
          selectedItem.type = isBase ? "custom_avenue" : "base_avenue";
          selectedItem.avenue = id;
        }
        if (!isBase) {
          const mode = customMode!.avenues[id];
          delete customMode!.avenues[id];
          const beforeKey =
            sortedBaseAvenues[targetIdx - 1]?.[1].position ?? rootKey;
          const afterKey =
            sortedBaseAvenues[targetIdx]?.[1].position ?? rootKey;
          baseAvenues[id] = {
            ...mode,
            position: keyBetween(beforeKey, afterKey),
          };
        } else if (isBase) {
          const mode = baseAvenues[id];
          delete baseAvenues[id];
          const beforeKey =
            sortedCustomAvenues[targetIdx - 1]?.[1].position ?? rootKey;
          const afterKey =
            sortedCustomAvenues[targetIdx]?.[1].position ?? rootKey;
          customMode!.avenues[id] = {
            ...mode,
            position: keyBetween(beforeKey, afterKey),
          };
        }
      }

      if (
        (hoveredItem[0].type === "base_avenue" && isBase) ||
        (hoveredItem[0].type === "custom_avenue" && !isBase)
      ) {
        const avenuesList = isBase ? sortedBaseAvenues : sortedCustomAvenues;
        const [otherItem, edge] = hoveredItem;
        const otherKey = otherItem.avenue;
        const i = avenuesList.findIndex(([k]) => k === id);
        if (otherKey === id) {
          return;
        }
        if (otherKey === avenuesList[i - 1]?.[0] && edge === "bottom") {
          return;
        }
        if (otherKey === avenuesList[i + 1]?.[0] && edge === "top") {
          return;
        }

        moveAcrossDebounced = null;

        const otherIdx = avenuesList.findIndex(([k]) => k === otherKey);
        const otherMode =
          otherIdx === -1
            ? undefined
            : isBase
              ? baseAvenues[otherKey]
              : customMode!.avenues[otherKey];
        if (!otherMode) {
          return;
        }
        const otherPos = otherMode.position ?? rootKey;

        const otherAdj: AvenueInfo | undefined =
          edge === "top"
            ? avenuesList[otherIdx - 1]?.[1]
            : avenuesList[otherIdx + 1]?.[1];
        const otherAdjPos = otherAdj?.position ?? rootKey;

        if (otherAdjPos === otherPos) {
          return;
        }

        item.position =
          edge === "top"
            ? keyBetween(otherAdjPos, otherPos)
            : keyBetween(otherPos, otherAdjPos);
      } else if (
        (hoveredItem[0].type === "base_avenue" && !isBase) ||
        (hoveredItem[0].type === "custom_avenue" && isBase)
      ) {
        moveAcrossDebounced = null;
        const avenuesList = isBase ? sortedCustomAvenues : sortedBaseAvenues;
        const otherIdx = avenuesList.findIndex(
          ([k]) => k === (hoveredItem![0] as { avenue: string }).avenue
        );
        flip(hoveredItem[1] === "top" ? otherIdx - 1 : otherIdx + 1);
      } else if (
        hoveredItem[0].type === "base_custom_divider" &&
        ((isBase && hoveredItem[1] === "bottom") ||
          (!isBase && hoveredItem[1] === "top")) &&
        !(moveAcrossDebounced === id)
      ) {
        moveAcrossDebounced = id;
        flip(isBase ? 0 : sortedBaseAvenues.length);
      }
    }
  }

  const selectedItemExists = $derived(
    (selectedItem?.type === "base_avenue" &&
      baseAvenues[selectedItem.avenue]) ||
      (selectedItem?.type === "custom_avenue" &&
        customMode!.avenues[selectedItem.avenue])
  );
</script>

<div
  class={`w-96 h-full border-r-2 border-amber-300 flex flex-col overflow-y-scroll ${
    selectedItem?.type === "base_avenue" &&
    selectedItem.avenue === sortedBaseAvenues[0]?.[0]
      ? "border-t-[4px]"
      : "pt-[4px]"
  } pb-[4px]`}
>
  {#each items as item (item.type === "base_avenue" ? `${item.avenue}` : item.type === "custom_avenue" ? `${item.avenue}` : item.type)}
    <div animate:flip={{ duration: 100 }}>
      {#if item.type === "base_custom_divider"}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          onmousemove={(e) => {
            if (
              e.clientY <
              (e.target as HTMLElement).getBoundingClientRect().top +
                (e.target as HTMLElement).getBoundingClientRect().height / 2
            ) {
              hoveredItem = [{ type: "base_custom_divider" }, "top"];
            } else {
              hoveredItem = [{ type: "base_custom_divider" }, "bottom"];
            }
          }}
        >
          <ConfigEditorDivider />
          <textarea
            class="w-full px-4 py-2 block font-editable"
            bind:this={descriptionTextarea}
            use:autosizeAction
            onchange={() => {
              tick().then(() => {
                if (descriptionTextarea) {
                  autosize.update(descriptionTextarea);
                }
              });
            }}
            rows={1}
            bind:value={
              () => decrypt(customMode!.description),
              (v) => {
                customMode!.description = encrypt(v);
              }
            }
            placeholder="Description..."
          >
          </textarea>
        </div>
      {:else if item.type === "add_avenue"}
        <ConfigEditorItem
          isSelected={false}
          onClick={() => {
            const key = crypto.randomUUID();

            if (customMode) {
              customMode.avenues[key] = {
                title: encrypt(""),
                description: encrypt(""),
                budgetMinutes: 15,
                position:
                  sortedCustomAvenues.length > 0
                    ? keyAfter(sortedCustomAvenues.at(-1)![1].position)
                    : keyAfter(rootKey),
              };
              selectedItem = { type: "custom_avenue", avenue: key };
            } else {
              baseAvenues[key] = {
                title: encrypt(""),
                description: encrypt(""),
                budgetMinutes: 15,
                position:
                  sortedBaseAvenues.length > 0
                    ? keyAfter(sortedBaseAvenues.at(-1)![1].position)
                    : keyAfter(rootKey),
              };
              selectedItem = { type: "base_avenue", avenue: key };
            }
          }}><i>+ Add avenue</i></ConfigEditorItem
        >
      {:else}
        {@const avenueItem = item as {
          type: "base_avenue" | "custom_avenue";
          avenue: string;
        }}
        {@const isBase = avenueItem.type === "base_avenue"}
        {@const isSelected =
          !!selectedItem &&
          "avenue" in selectedItem &&
          selectedItem.avenue === avenueItem.avenue}
        <ConfigEditorItem
          {isSelected}
          onClick={() =>
            (selectedItem = {
              type: avenueItem.type,
              avenue: avenueItem.avenue,
            })}
          onHover={(edge) =>
            (hoveredItem = [
              { type: avenueItem.type, avenue: avenueItem.avenue },
              edge,
            ])}
          onDrag={() =>
            dragAvenue(
              isBase,
              avenueItem.avenue,
              isBase
                ? baseAvenues[avenueItem.avenue]
                : customMode!.avenues[avenueItem.avenue]
            )}
          onDragEnd={() => {
            moveAcrossDebounced = null;
          }}
        >
          <Edito
            bind:value={
              () =>
                decrypt(
                  (isBase
                    ? baseAvenues[avenueItem.avenue]
                    : customMode!.avenues[avenueItem.avenue]
                  ).title
                ),
              (v) => {
                (isBase
                  ? baseAvenues[avenueItem.avenue]
                  : customMode!.avenues[avenueItem.avenue]
                ).title = encrypt(v);
              }
            }
            placeholder="Unnamed avenue"
            editable={isSelected}
          />
          <DurationDraggo
            bind:duration={
              () =>
                Temporal.Duration.from({
                  nanoseconds: Math.round(
                    (isBase
                      ? baseAvenues[avenueItem.avenue]
                      : customMode!.avenues[avenueItem.avenue]
                    ).budgetMinutes *
                      60 *
                      1000 *
                      1000 *
                      1000
                  ),
                }),
              (v: Temporal.Duration) => {
                (isBase
                  ? baseAvenues[avenueItem.avenue]
                  : customMode!.avenues[avenueItem.avenue]
                ).budgetMinutes = v.total({ unit: "minutes" });
              }
            }
          />
          {#if isSelected}
            <div class="flex-grow"></div>
            <Trash
              class="w-4 h-4"
              onclick={() => {
                if (isBase) {
                  delete baseAvenues[avenueItem.avenue];
                } else {
                  delete customMode!.avenues[avenueItem.avenue];
                }
                selectedItem = null;
              }}
            />
          {/if}
        </ConfigEditorItem>
      {/if}
    </div>
  {/each}
</div>

<svelte:boundary
  onerror={(e, reset) => (console.error(e), setTimeout(reset, 1000))}
>
  <div class="h-full grow p-4 flex flex-col justify-stretch items-stretch">
    {#if selectedItemExists}
      {@const avenue =
        selectedItem.type === "custom_avenue"
          ? customMode!.avenues[selectedItem.avenue]
          : baseAvenues[selectedItem.avenue]}
      <input
        class="text-2xl font-bold font-editable"
        bind:value={
          () => decrypt(avenue.title),
          (v) => {
            avenue.title = encrypt(v);
          }
        }
      />
      <textarea
        class="grow font-editable"
        bind:value={
          () => decrypt(avenue.description),
          (v) => {
            avenue.description = encrypt(v);
          }
        }
      ></textarea>
    {/if}
  </div>
</svelte:boundary>
