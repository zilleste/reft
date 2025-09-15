export type DeepImmutable<T> = T extends Map<infer K, infer V>
  ? ReadonlyMap<DeepImmutable<K>, DeepImmutable<V>>
  : T extends Set<infer S>
  ? ReadonlySet<DeepImmutable<S>>
  : T extends object
  ? { readonly [K in keyof T]: DeepImmutable<T[K]> }
  : T;
