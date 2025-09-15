<script lang="ts">
  import "../app.css";
  import "@fontsource/monaspace-argon";
  import "@fontsource/monaspace-xenon";
  import "@fontsource/monaspace-krypton";
  import "@fontsource/monaspace-radon";
  import "@fontsource/monaspace-neon";
  import "$lib/debugHelper.svelte";
  import { onMount } from "svelte";
  import type { FirebaseApp } from "firebase/app";
  import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    type User,
  } from "firebase/auth";
  import { isPasswordSet, setPassword } from "$lib/crypto.svelte";
  import { getFirebaseApp } from "$lib/firebaseClient";
  import { registerDebugHelper } from "$lib/debugHelper.svelte";

  registerDebugHelper();

  let { children } = $props();

  // Minimal Firebase init (shared)
  function ensureApp(): FirebaseApp {
    return getFirebaseApp();
  }

  // Auth state
  let user = $state<User | null>(null);
  let authError = $state<string | null>(null);
  let email = $state("");
  let password = $state("");
  let isLoggingIn = $state(false);
  let authReady = $state(false);

  // Encryption password
  let encPassword = $state("");
  let encError = $state<string | null>(null);

  onMount(() => {
    const app = ensureApp();
    const auth = getAuth(app);
    const off = onAuthStateChanged(auth, (u) => {
      user = u;
      authError = null;
      // reset encryption prompt on user change
      encPassword = "";
      encError = null;
    });
    auth
      .authStateReady()
      .catch(() => {})
      .then(() => {
        authReady = true;
      });
    return () => {
      off();
    };
  });

  async function login(e: Event) {
    e.preventDefault();
    authError = null;
    try {
      isLoggingIn = true;
      const auth = getAuth(ensureApp());
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      authError = (err as Error).message ?? "Login failed";
    } finally {
      isLoggingIn = false;
    }
  }

  function setEncPassword(e: Event) {
    e.preventDefault();
    encError = null;
    const value = encPassword;
    if (!value || value.length < 6) {
      encError = "Please enter at least 6 characters";
      return;
    }
    try {
      setPassword(value);
    } catch (err) {
      encError = (err as Error).message ?? "Could not set password";
    }
  }
</script>

{#snippet loading(type: string)}
  <div class="min-h-screen grid place-items-center p-6 text-amber-300">
    <div class="flex items-center gap-3 text-gray-700">
      <svg
        class="animate-spin h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke-width="4" />
        <path class="opacity-75" stroke-width="4" d="M4 12a8 8 0 018-8" />
      </svg>
      <span>Loading {type}…</span>
    </div>
  </div>
{/snippet}

{#if !authReady}
  {@render loading("account")}
{:else if !user}
  <div class="min-h-screen grid place-items-center p-6 text-amber-300">
    <form class="w-full max-w-sm space-y-4" onsubmit={login}>
      <h1 class="text-2xl font-semibold">Sign in</h1>
      {#if authError}
        <p class="text-red-600 text-sm">{authError}</p>
      {/if}
      <label class="block">
        <span class="block text-sm mb-1">Email</span>
        <input
          class="w-full border rounded px-3 py-2"
          type="email"
          bind:value={email}
          required
          autocomplete="username"
          disabled={isLoggingIn}
        />
      </label>
      <label class="block">
        <span class="block text-sm mb-1">Password</span>
        <input
          class="w-full border rounded px-3 py-2"
          type="password"
          bind:value={password}
          required
          autocomplete="current-password"
          disabled={isLoggingIn}
        />
      </label>
      <button
        class="w-full bg-amber-300 text-black rounded px-3 py-2"
        type="submit"
        disabled={isLoggingIn}
      >
        {isLoggingIn ? "Signing in..." : "Sign in"}
      </button>
    </form>
  </div>
{:else if !isPasswordSet()}
  <div class="min-h-screen grid place-items-center p-6 text-amber-300">
    <form class="w-full max-w-sm space-y-4" onsubmit={setEncPassword}>
      <h1 class="text-2xl font-semibold">Encryption password</h1>
      <p class="text-sm">Please enter your encryption password.</p>
      {#if encError}
        <p class="text-red-600 text-sm">{encError}</p>
      {/if}
      <label class="block">
        <span class="block text-sm mb-1">Password</span>
        <input
          class="w-full border rounded px-3 py-2"
          type="password"
          bind:value={encPassword}
          required
          autocomplete="new-password"
        />
      </label>
      <button
        class="w-full bg-amber-300 text-black rounded px-3 py-2"
        type="submit"
      >
        Continue
      </button>
    </form>
  </div>
{:else}
  <svelte:boundary
    onerror={(e, reset) => {
      console.error(e);
      setTimeout(reset, 1000);
    }}
  >
    {@render children?.()}
    {#snippet pending()}
      {@render loading("content")}
    {/snippet}
  </svelte:boundary>
{/if}
