import type { OutgoingHttpHeaders } from 'node:http'

import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import { createMemoryCache } from './memory-cache'

export interface CachedData {
  meta: OutgoingHttpHeaders
  buffer: Buffer
}

export interface CacheAccessOptions {
  /** Whether this request is flagged as high-priority (see `cache-key.ts`). */
  priority?: boolean
}

export interface CacheStorage {
  set: (key: string, val: CachedData, opts?: CacheAccessOptions) => Promise<void>
  get: (key: string, opts?: CacheAccessOptions) => Promise<CachedData | undefined>
  del: (key: string) => Promise<void>
  clear: () => void
}

export interface CreateCacheOptions {
  memory?: {
    enabled?: boolean
    maxItems?: number
    /** When true, only priority-flagged requests are written into/promoted to L1. */
    priorityOnly?: boolean
  }
}

/**
 * Two-tier cache: an in-memory LRU (L1, fast, per-process) in front of a
 * persistent disk store (L2, unstorage fs driver, survives restarts).
 * `key` is expected to already be a hashed, filesystem-safe cache key
 * (see cache-key.ts) — this module does no further sanitization.
 */
export function createCache(cacheDir: string, options: CreateCacheOptions = {}): CacheStorage {
  const store = createStorage<string>({ driver: fsDriver({ base: cacheDir }) })
  const memoryEnabled = options.memory?.enabled ?? true
  const priorityOnly = options.memory?.priorityOnly ?? false
  const memory = memoryEnabled
    ? createMemoryCache<CachedData>({ maxItems: options.memory?.maxItems })
    : undefined

  const admitsMemory = (opts?: CacheAccessOptions) => !priorityOnly || opts?.priority === true

  return {
    async get(key, opts) {
      const fromMemory = memory?.get(key)
      if (fromMemory){
        return fromMemory
      }

      const raw = await store.getItemRaw(key)
      if (!raw) return undefined

      const meta = (await store.getItem(`${key}.json`)) as OutgoingHttpHeaders | null
      const data: CachedData = { meta: meta ?? {}, buffer: raw as Buffer }
      if (admitsMemory(opts)) memory?.set(key, data)
      return data
    },

    async set(key, val, opts) {
      if (admitsMemory(opts)) memory?.set(key, val)
      await Promise.all([
        store.setItemRaw(key, val.buffer),
        store.setItem(`${key}.json`, JSON.stringify(val.meta)),
      ]).catch((err) => {
        console.error('[ipx-output-cache] Failed to write disk cache:', key, err)
      })
    },

    async del(key) {
      memory?.del(key)
      await Promise.all([store.removeItem(key), store.removeItem(`${key}.json`)]).catch(() => void 0)
    },

    clear() {
      memory?.clear()
      store.clear()
    },
  }
}
