<script lang="ts">
  import ConfigEditor from "$lib/components/configEditor/ConfigEditor.svelte";
  import Home from "$lib/components/home/Home.svelte";
  import { nextDayReady } from "$lib/components/home/homeUtil";
  import { decrypt, encrypt } from "$lib/crypto.svelte";
  import { dayState, permanentState, db } from "$lib/dbApi.svelte";
  import { desktop } from "$lib/electronIpc";
  import {
    currentSession,
    currentSessionTimeLeft,
  } from "$lib/sessioncalc.svelte";
  import { onDestroy, onMount, untrack } from "svelte";
  import { Temporal } from "temporal-polyfill";
  import Notepad from "$lib/components/Notepad.svelte";

  let currentPage: "home" | "config" | "notepad" = $state("home");
  let configSaverInterval: ReturnType<typeof setInterval> | null = $state(null);

  function toggleConfig() {
    if (currentPage === "config") {
      currentPage = "home";
      db.setPermanentState(config);
      if (configSaverInterval !== null) {
        clearInterval(configSaverInterval);
      }
    } else {
      permanentState().then((state) => {
        config = state;
        currentPage = "config";
        if (configSaverInterval === null) {
          configSaverInterval = setInterval(() => {
            db.setPermanentState(config);
          }, 5000);
        }
      });
    }
  }

  onDestroy(() => {
    if (configSaverInterval !== null) {
      clearInterval(configSaverInterval);
    }
  });

  function onStepAway(start: Temporal.Instant, end: Temporal.Instant) {
    if (Temporal.Now.instant().until(end).total("seconds") < 60) {
      onEndCurrentSession();
    }
    db.stepAway(start, end);
  }

  function onSessionStart(
    avenue: string,
    start: Temporal.Instant,
    end: Temporal.Instant
  ) {
    db.sessionStart(avenue, start, end);
  }

  function onBypassStart(start: Temporal.Instant, end: Temporal.Instant) {
    db.bypassStart(start, end);
  }

  function onDayEndUndo() {
    db.dayEndUndo();
  }

  function onDayEnd() {
    onEndCurrentSession();
    db.dayEnd();
  }

  function onAvenueDone(avenue: string) {
    db.avenueDone(avenue);
  }

  function onEndCurrentSession() {
    const current = currentSession(allSessions);
    if (current) {
      db.endCurrentSession();
    }
  }

  function onNotepad() {
    currentPage = "notepad";
  }

  function onShutdown() {
    onEndCurrentSession();
    desktop.shutdown();
  }

  let config = $state(await permanentState());

  $effect(() => {
    permanentState().then((state) => {
      config = state;
    });
  });

  const today = $derived(await dayState());

  const avenueSessions = $derived(
    Object.values(today.avenues).flatMap((avenue) =>
      Object.values(avenue.sessions).map((session) => ({
        ...session,
        title: avenue.info.title,
      }))
    )
  );
  const bypassSessions = $derived(
    Object.values(today.bypasses).map((bypass) => ({
      ...bypass,
      title: encrypt("Bypass"),
    }))
  );
  const allSessions = $derived([...avenueSessions, ...bypassSessions]);

  $effect(() => {
    const current = currentSession(allSessions);
    const currentTimeLeft = currentSessionTimeLeft(allSessions);

    if (current && currentTimeLeft) {
      console.log("setting mode to UNLOCKED");
      desktop.setMode("unlocked");
      desktop.setTrayTitle(
        `${decrypt(current.title)} ${currentTimeLeft
          .round({ smallestUnit: "seconds", largestUnit: "hours" })
          .toLocaleString("en-US", {
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
          })}`
      );
    } else {
      console.log("setting mode to LOCKED");
      desktop.setMode("locked");
    }
  });

  onMount(() => {
    return desktop.onDeviceLock(() => {
      const current = currentSession(allSessions);
      if (current && current.end - current.start < 1000 * 60 * 60) {
        db.endCurrentSession();
      }
    });
  });

  onMount(() => {
    return desktop.onTrayClick(() => {
      onEndCurrentSession();
    });
  });
</script>

<div class="text-amber-300 w-screen h-screen">
  {#if currentPage === "home"}
    <Home
      dayState={today}
      onConfig={toggleConfig}
      {onStepAway}
      {onSessionStart}
      {onBypassStart}
      {onDayEndUndo}
      {onDayEnd}
      {onAvenueDone}
      {onEndCurrentSession}
      {onNotepad}
      {onShutdown}
    />
  {:else if currentPage === "config"}
    <ConfigEditor
      bind:config
      goBack={toggleConfig}
      startDay={(mode) => {
        db.startDay(mode);
      }}
    />
  {:else if currentPage === "notepad"}
    <svelte:boundary>
      {#snippet pending()}
        <p>loading...</p>
      {/snippet}

      <Notepad
        save={(content) => {
          desktop.setNotepadContent(content);
        }}
        goBack={() => {
          currentPage = "home";
        }}
        contentPromise={desktop.getNotepadContent()}
      />
    </svelte:boundary>
  {/if}
</div>
