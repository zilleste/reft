import { dayState, db, permanentState } from "./dbApi.svelte";

export function registerDebugHelper() {
  (window as any).opal = {
    dayState: () => dayState(),
    permanentState: () => permanentState(),
    db: () => db,
  };
}
