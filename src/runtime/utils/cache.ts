import type { OutgoingHttpHeaders } from 'http';

import { createStorage } from 'unstorage';
import fsDriver from 'unstorage/drivers/fs';

export function createCache(cacheDir: string) {
  const store = createStorage<string>({ driver: fsDriver({ base: cacheDir }) });
  return <CacheStorage>{
    async get(path) {
      const raw = await store.getItemRaw(path);
      if (!raw) return;

      const meta = await store.getItem(`${path}.json`);
      return { meta, buffer: raw };
    },

    async set(path, v) {
      await Promise.all([
        store.setItemRaw(path, v.buffer),
        store.setItem(`${path}.json`, JSON.stringify(v.meta)),
      ]).catch(console.error);
    },

    async del(path) {
      const promises = [store.removeItem(path), store.removeItem(`${path}.json`)];
      await Promise.all(promises).catch(() => void 0);
    },

    clear() {
      store.clear();
    },
  };
}

interface CachedData {
  meta: OutgoingHttpHeaders;
  buffer: Buffer;
}

interface CacheStorage {
  set: (path: string, val: CachedData, ttl?: number) => Promise<void>;
  get: (path: string) => Promise<CachedData | undefined>;
  del: (path: string) => Promise<void>;
  clear: () => void;
}
