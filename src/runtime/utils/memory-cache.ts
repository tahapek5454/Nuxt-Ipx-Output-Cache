export interface MemoryCacheEntry<T> {
  value: T
  size: number
}

export interface MemoryCache<T> {
  get: (key: string) => T | undefined
  set: (key: string, value: T, size?: number) => void
  del: (key: string) => void
  clear: () => void
}

export interface MemoryCacheOptions {
  /** Max number of entries kept in memory before evicting the least recently used. */
  maxItems?: number
}

/**
 * Minimal in-memory LRU. Relies on Map preserving insertion order: on every
 * access the key is re-inserted so it moves to the "most recent" end, and
 * eviction simply removes the first (oldest) key once over `maxItems`.
 */
export function createMemoryCache<T>(options: MemoryCacheOptions = {}): MemoryCache<T> {
  const maxItems = options.maxItems ?? 100
  const store = new Map<string, T>()

  return {
    get(key) {
      if (!store.has(key)) return undefined
      const value = store.get(key)!
      // bump recency
      store.delete(key)
      store.set(key, value)
      return value
    },

    set(key, value) {
      store.delete(key)
      store.set(key, value)
      while (store.size > maxItems) {
        const oldest = store.keys().next().value
        if (oldest === undefined) break
        store.delete(oldest)
      }
    },

    del(key) {
      store.delete(key)
    },

    clear() {
      store.clear()
    },
  }
}
