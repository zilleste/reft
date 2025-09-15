<script lang="ts">
  import { decrypt, encrypt } from "$lib/crypto.svelte";
  import type { CustomMode, PermanentState } from "$lib/dbTypes";
  import { comparer, keyAfter, keyBetween, rootKey } from "$lib/ordering";
  import { flip } from "svelte/animate";
  import Edito from "../Edito.svelte";
  import ConfigEditorItem from "./ConfigEditorItem.svelte";
  import { ArrowLeft, Trash } from "@lucide/svelte";
  import ConfigEditorMode from "./ConfigEditorMode.svelte";
  import FrictionButton from "../FrictionButton.svelte";
  import { onMount } from "svelte";

  let {
    config = $bindable(),
    startDay,
    goBack,
  }: {
    config: PermanentState;
    startDay?: (selectedMode: string) => void;
    goBack?: () => void;
  } = $props();

  type MenuItem =
    | {
        type: "custom_mode";
        mode: [string, CustomMode];
      }
    | {
        type: "spacer";
      }
    | {
        type: "allowed_packages";
      };

  const customModes = $derived(
    Object.entries(config.customModes).sort(comparer((x) => x[1].position))
  );

  let selectedItem = $state<MenuItem | null>(null);

  let hoveredCustomMode = $state<[string, "top" | "bottom"] | null>(null);

  onMount(() => {
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        goBack?.();
      }
    };
    window.addEventListener("keydown", escapeHandler);
    return () => window.removeEventListener("keydown", escapeHandler);
  });
</script>

<svelte:boundary
  onerror={(e, reset) => (console.error(e), setTimeout(reset, 1000))}
>
  <div
    class="w-full h-full overflow-hidden flex flex-col justify-stretch items-stretch pt-8"
  >
    <div
      class="flex flex-row border-2 border-amber-300 m-4 grow rounded-2xl overflow-hidden"
    >
      <div
        class={`w-96 h-full border-r-2 border-amber-300 flex flex-col overflow-y-scroll ${
          selectedItem?.type === "custom_mode" &&
          selectedItem.mode[0] === customModes[0]?.[0]
            ? "border-t-[4px]"
            : "pt-[4px]"
        } ${
          selectedItem?.type === "allowed_packages" && !goBack
            ? "border-b-[4px]"
            : "pb-[4px]"
        }`}
      >
        {#each customModes as [key, mode], i (key)}
          {@const isSelected =
            selectedItem?.type === "custom_mode" &&
            selectedItem.mode[0] === key}
          <div animate:flip={{ duration: 100 }}>
            <ConfigEditorItem
              {isSelected}
              onClick={() =>
                (selectedItem = { type: "custom_mode", mode: [key, mode] })}
              onHover={(edge) => (hoveredCustomMode = [key, edge])}
              onDrag={(mouseX, mouseY) => {
                if (hoveredCustomMode) {
                  const [otherKey, edge] = hoveredCustomMode;
                  if (otherKey === key) {
                    return;
                  }
                  if (
                    otherKey === customModes[i - 1]?.[0] &&
                    edge === "bottom"
                  ) {
                    return;
                  }
                  if (otherKey === customModes[i + 1]?.[0] && edge === "top") {
                    return;
                  }

                  const otherIdx = customModes.findIndex(
                    ([k]) => k === otherKey
                  );
                  const otherMode =
                    otherIdx === -1 ? undefined : config.customModes[otherKey];
                  if (!otherMode) {
                    return;
                  }
                  const otherPos = otherMode.position ?? rootKey;

                  const otherAdj: CustomMode | undefined =
                    edge === "top"
                      ? customModes[otherIdx - 1]?.[1]
                      : customModes[otherIdx + 1]?.[1];
                  const otherAdjPos = otherAdj?.position ?? rootKey;

                  if (otherAdjPos === otherPos) {
                    return;
                  }

                  mode.position =
                    edge === "top"
                      ? keyBetween(otherAdjPos, otherPos)
                      : keyBetween(otherPos, otherAdjPos);
                }
              }}
            >
              <Edito
                bind:value={
                  () => decrypt(mode.title),
                  (v) => (config.customModes[key].title = encrypt(v))
                }
                editable={isSelected}
                placeholder="Unnamed mode"
              />
              <div class="flex-grow"></div>
              {#if isSelected}
                <Trash
                  class="w-4 h-4"
                  onclick={() => {
                    delete config.customModes[key];
                    selectedItem = null;
                  }}
                />
              {/if}
            </ConfigEditorItem>
          </div>
        {/each}
        <ConfigEditorItem
          isSelected={false}
          onClick={() => {
            const key = crypto.randomUUID();
            config.customModes[key] = {
              title: encrypt(""),
              description: encrypt(""),
              avenues: {},
              position:
                customModes.length > 0
                  ? keyAfter(customModes.at(-1)![1].position)
                  : rootKey,
            };
            selectedItem = {
              type: "custom_mode",
              mode: [key, config.customModes[key]],
            };
          }}><i>+ Add mode</i></ConfigEditorItem
        >
        <div class="flex-grow"></div>
        {#if startDay && selectedItem?.type === "custom_mode"}
          <div class="p-4">
            <FrictionButton
              friction={5000}
              onactivate={() => {
                if (selectedItem?.type === "custom_mode") {
                  startDay?.(selectedItem.mode[0]);
                }
              }}>Start new day</FrictionButton
            >
          </div>
        {/if}
        <ConfigEditorItem
          isSelected={selectedItem?.type === "allowed_packages"}
          onClick={() => (selectedItem = { type: "allowed_packages" })}
        >
          Mobile whitelist
        </ConfigEditorItem>
        {#if goBack}
          <ConfigEditorItem isSelected={false} onClick={goBack}>
            <ArrowLeft class="w-4 h-4" /> Back
          </ConfigEditorItem>
        {/if}
      </div>

      {#if selectedItem?.type === "custom_mode"}
        <ConfigEditorMode
          bind:baseAvenues={config.baseAvenues}
          bind:customMode={config.customModes[selectedItem.mode[0]]}
        />
      {/if}
    </div>
  </div>
</svelte:boundary>
