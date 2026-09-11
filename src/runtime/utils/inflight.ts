/**
 * De-dupes concurrent calls for the same key so only one `factory()` runs at a
 * time per key (prevents "thundering herd" re-processing of the same image).
 * Concurrent callers with the same key await the same promise; the entry is
 * always removed once settled so a later call re-triggers the factory.
 */
export function createInflightMap<T>() {
  const inflight = new Map<string, Promise<T>>()

  function has(key: string): boolean {
    return inflight.has(key)
  }

  async function once(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = inflight.get(key)
    if (existing) return existing

    const promise = factory().finally(() => {
      inflight.delete(key)
    })

    inflight.set(key, promise)
    return promise
  }

  return { once, has }
}

export type InflightMap<T> = ReturnType<typeof createInflightMap<T>>
