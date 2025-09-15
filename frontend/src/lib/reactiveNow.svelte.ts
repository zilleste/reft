import { Temporal } from "temporal-polyfill";

let _now = $state(Temporal.Now.instant());

setInterval(() => {
  _now = Temporal.Now.instant();
}, 1000);

export const now = () => _now;
