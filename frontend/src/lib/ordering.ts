import z from "zod";

declare const orderKeyTag: unique symbol;

export const OrderKey: z.ZodType<OrderKey, string> = z.string() as any;
export type OrderKey = {
  [orderKeyTag]: true;
};

// Base-62 alphabet; ASCII order ensures DB bytewise lexicographic order works.
const ALPH = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = ALPH.length;

// Convert between strings and digit arrays
const toDigits = (s: string) => Array.from(s, (ch) => ALPH.indexOf(ch));
const fromDigits = (ds: number[]) => ds.map((d) => ALPH[d]).join("");

// Return a key strictly between a and b ("" means -∞ for a, +∞ for b if b=="")
export function keyBetween(_a: OrderKey, _b: OrderKey): OrderKey {
  const a = _a as unknown as string;
  const b = _b as unknown as string;
  if (a && b && !(a < b)) {
    if (a === b) {
      return _a;
    } else {
      return keyBetween(_b, _a);
    }
  }
  const A = toDigits(a),
    B = toDigits(b);
  const prefix: number[] = [];
  let i = 0;
  while (true) {
    const x = i < A.length ? A[i] : 0; // pad a with 0s
    const y = i < B.length ? B[i] : BASE - 1; // pad b with (BASE-1)s
    if (y - x >= 2) {
      const mid = Math.floor((x + y) / 2); // pick a midpoint (optionally random in (x,y))
      prefix.push(mid);
      return fromDigits(prefix) as unknown as OrderKey;
    }
    // No room at this digit; copy the shared/left digit and go deeper
    prefix.push(x);
    i += 1;
  }
}

export function keyBefore(a: OrderKey): OrderKey {
  return keyBetween(rootKey, a);
}

export function keyAfter(a: OrderKey): OrderKey {
  return keyBetween(a, rootKey);
}

export const rootKey: OrderKey = "" as unknown as OrderKey;

export const comparer =
  <T>(fn: (x: T) => OrderKey) =>
  (a: T, b: T) =>
    (fn(a) as unknown as string) > (fn(b) as unknown as string) ? 1 : -1;
