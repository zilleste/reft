export type CacheCache<K, V> = {
  get: GetFunction<K, V>;
  set: (key: K, value: V) => void;
};

export type CacheCacheOptions = {
  maxSize: number;
};

type GetFunction<K, V> = {
  (key: K): V | undefined;
  (key: K, fallback: () => V): V;
};

const defaultOptions: CacheCacheOptions = {
  maxSize: 1000,
};

export function cachecache<K, V>(
  options: Partial<CacheCacheOptions> = {}
): CacheCache<K, V> {
  const config: CacheCacheOptions = { ...defaultOptions, ...options };

  // Use Map to track insertion order. We'll treat the end of the Map
  // as most-recently-used. On access/set, move key to the end.
  const store = new Map<K, V>();

  function evictIfNeeded() {
    while (store.size > config.maxSize && store.size > 0) {
      const oldestKey = store.keys().next().value as K;
      store.delete(oldestKey);
    }
  }

  function set(key: K, value: V): void {
    if (store.has(key)) {
      // Refresh order
      store.delete(key);
    }
    store.set(key, value);
    evictIfNeeded();
  }

  function get(key: K): V | undefined;
  function get(key: K, fallback: () => V): V;
  function get(key: K, fallback?: () => V): V | undefined {
    if (store.has(key)) {
      const value = store.get(key)!;
      // mark as recently used
      store.delete(key);
      store.set(key, value);
      return value;
    }

    if (fallback) {
      const v = fallback();
      set(key, v);
      return v;
    }

    return undefined;
  }

  return { get, set };
}
