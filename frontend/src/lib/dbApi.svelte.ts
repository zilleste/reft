import type {
  BoundedSession,
  BypassSession,
  DayState,
  PermanentState,
} from "./dbTypes";
import { browser } from "$app/environment";
import type { FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  query as fsQuery,
  orderBy as fsOrderBy,
  limit as fsLimit,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getFirebaseApp } from "$lib/firebaseClient";
import { encrypt, encryptEmpty } from "./crypto.svelte";
import { getAuth } from "firebase/auth";
import type { DeepImmutable } from "./typeutil";
import { get } from "svelte/store";
import { Temporal } from "temporal-polyfill";
import { allCurrentSessions, currentSession } from "./sessioncalc.svelte";
import { now } from "./reactiveNow.svelte";

const defaultDayState: DayState = {
  start: 0,
  end: null,
  isDetox: false,
  stepAway: {},
  modeTitle: encryptEmpty(),
  avenues: {},
  bypasses: {},
  modeDescription: encryptEmpty(),
};

const defaultPermanentState: PermanentState = {
  baseAvenues: {},
  baseApps: {},
  customModes: {},
};

// use a default state while the db is initializing
let _dayState: DeepImmutable<DayState | null> = $state(null);
let _permanentState: DeepImmutable<PermanentState | null> = $state(null);

let { promise: dayStateInitPromise, resolve: resolveDayStateInit } =
  Promise.withResolvers<void>();
let { promise: permanentStateInitPromise, resolve: resolvePermanentStateInit } =
  Promise.withResolvers<void>();

/**
 * Gets a reactive copy of the current day state.
 */
export const dayState = () => {
  if (_dayState === null) {
    return dayStateInitPromise.then(() => _dayState!);
  }
  return Promise.resolve(_dayState);
};
/**
 * Gets a reactive copy of the permanent state.
 */
export const permanentState = () => {
  if (_permanentState === null) {
    return permanentStateInitPromise.then(() => _permanentState!);
  }
  return Promise.resolve(_permanentState);
};

export const db = await (async () => {
  const app = getFirebaseApp();
  const firestore = initializeFirestore(app, {
    localCache: persistentLocalCache(
      /*settings*/ {
        tabManager: persistentMultipleTabManager(),
      }
    ),
  });
  const auth = getAuth(app);

  const authStateUnsubscribers: (() => void)[] = [];

  let userIdResolved = false;
  let {
    promise: userId,
    resolve: resolveUserId,
  }: {
    promise: Promise<string>;
    resolve: null | ((value: string) => void);
  } = Promise.withResolvers<string>();

  const getDayRef = async (userId: string) => {
    const dayQuery = fsQuery(
      collection(firestore, "users", userId, "days"),
      fsOrderBy("start", "desc"),
      fsLimit(1)
    );
    const snapshot = await getDocs(dayQuery);
    if (snapshot.empty) {
      const id = crypto.randomUUID();
      setDoc(doc(firestore, "users", userId, "days", id), defaultDayState);
      return doc(firestore, "users", userId, "days", id);
    }
    return snapshot.docs[0].ref;
  };

  async function addDbSubscriptions(userId: string) {
    console.log("adding db subscriptions for user", userId);

    for (const unsub of authStateUnsubscribers) {
      unsub();
    }
    authStateUnsubscribers.length = 0;

    // Firestore: users collection stores PermanentState at users/{uid}
    const userDocRef = doc(firestore, "users", userId);

    // Firestore: subcollection days stores DayState documents; latest (by start) is effective
    const daysCol = collection(firestore, "users", userId, "days");
    const dayQuery = fsQuery(daysCol, fsOrderBy("start", "desc"), fsLimit(1));

    authStateUnsubscribers.push(
      onSnapshot(dayQuery, (snapshot) => {
        if (snapshot.empty) {
          _dayState = defaultDayState;
        } else {
          const docSnap = snapshot.docs[0];
          _dayState = (docSnap.data() as DayState) ?? defaultDayState;
          resolveDayStateInit();
        }
      })
    );

    authStateUnsubscribers.push(
      onSnapshot(userDocRef, (snapshot) => {
        console.log("permanent state snapshot", snapshot.data());
        const data =
          (snapshot.data() as PermanentState | undefined) ??
          defaultPermanentState;
        _permanentState = data;
        resolvePermanentStateInit();
      })
    );
  }

  auth.onAuthStateChanged((user) => {
    if (user) {
      if (resolveUserId) {
        resolveUserId(user.uid);
        resolveUserId = null;
      } else {
        userId = Promise.resolve(user.uid);
      }
      addDbSubscriptions(user.uid);
    }
  });

  return {
    setPermanentState: async (state: DeepImmutable<PermanentState>) => {
      console.log("setting permanent state", state);
      setDoc(doc(firestore, "users", await userId), state);
    },
    stepAway: async (start: Temporal.Instant, end: Temporal.Instant) => {
      const dayRef = await getDayRef(await userId);
      const id = crypto.randomUUID();
      const bs: BoundedSession = {
        start: start.epochMilliseconds,
        end: end.epochMilliseconds,
        // TODO: implement deviceId
        deviceId: "",
      };
      await updateDoc(dayRef, {
        [`stepAway.${id}`]: bs,
      });
    },
    sessionStart: async (
      avenue: string,
      start: Temporal.Instant,
      end: Temporal.Instant
    ) => {
      const dayRef = await getDayRef(await userId);
      const id = crypto.randomUUID();
      const bs: BoundedSession = {
        start: start.epochMilliseconds,
        end: end.epochMilliseconds,
        // TODO: implement deviceId
        deviceId: "",
      };
      await updateDoc(dayRef, {
        [`avenues.${avenue}.sessions.${id}`]: bs,
      });
    },
    bypassStart: async (
      start: Temporal.Instant,
      end: Temporal.Instant,
      mode: "normal" | "detox"
    ) => {
      const dayRef = await getDayRef(await userId);
      const id = crypto.randomUUID();
      const bs: BypassSession = {
        start: start.epochMilliseconds,
        end: end.epochMilliseconds,
        // TODO: implement deviceId
        deviceId: "",
        mode,
      };
      await updateDoc(dayRef, {
        [`bypasses.${id}`]: bs,
      });
    },
    dayEndUndo: async () => {
      const dayRef = await getDayRef(await userId);
      await updateDoc(dayRef, {
        end: null,
      });
    },
    dayEnd: async () => {
      const dayRef = await getDayRef(await userId);
      await updateDoc(dayRef, {
        end: Temporal.Now.instant().epochMilliseconds,
      });
    },
    avenueDone: async (avenue: string) => {
      const dayRef = await getDayRef(await userId);
      await updateDoc(dayRef, {
        [`avenues.${avenue}.done`]: true,
      });
    },
    startDay: async (
      mode: { type: "custom"; mode: string } | { type: "detox" }
    ) => {
      const id = crypto.randomUUID();
      const uid = await userId;
      const config = await permanentState();

      if (mode.type === "custom") {
        const modeConfig = config.customModes[mode.mode];
        if (modeConfig == null) {
          throw new Error(`Custom mode ${mode.mode} not found`);
        }
        await setDoc(doc(firestore, "users", uid, "days", id), {
          start: Temporal.Now.instant().epochMilliseconds,
          end: null,
          modeTitle: modeConfig.title,
          modeDescription: modeConfig.description,
          isDetox: false,
          stepAway: {},
          avenues: Object.fromEntries([
            ...Object.entries(config.baseAvenues).map(([id, info]) => [
              id,
              { info, sessions: {}, done: false },
            ]),
            ...Object.entries(modeConfig.avenues).map(([id, info]) => [
              id,
              { info, sessions: {}, done: false },
            ]),
          ]),
          bypasses: {},
        } satisfies DayState);
      } else {
        await setDoc(doc(firestore, "users", uid, "days", id), {
          start: Temporal.Now.instant().epochMilliseconds,
          end: null,
          modeTitle: encrypt("Detox"),
          modeDescription: encrypt("Log off and relax."),
          isDetox: true,
          stepAway: {},
          avenues: Object.fromEntries(
            Object.entries(config.baseAvenues).map(([id, info]) => [
              id,
              { info, sessions: {}, done: false },
            ])
          ),
          bypasses: {},
        } satisfies DayState);
      }
    },
    endCurrentSession: async () => {
      const dayRef = await getDayRef(await userId);
      const today = await dayState();

      const avenueSessions = Object.entries(today.avenues).flatMap(
        ([avenueId, avenue]) =>
          Object.entries(avenue.sessions).map(([sessionId, session]) => ({
            ...session,
            endNow: async () => {
              await updateDoc(dayRef, {
                [`avenues.${avenueId}.sessions.${sessionId}.end`]:
                  now().epochMilliseconds,
              });
            },
          }))
      );

      const bypassSessions = Object.entries(today.bypasses).map(
        ([sessionId, session]) => ({
          ...session,
          endNow: async () => {
            await updateDoc(dayRef, {
              [`bypasses.${sessionId}.end`]: now().epochMilliseconds,
            });
          },
        })
      );

      const allSessions = [...avenueSessions, ...bypassSessions];

      const current = allCurrentSessions(allSessions);

      for (const session of current) {
        await session.endNow();
      }
    },
  };
})();
