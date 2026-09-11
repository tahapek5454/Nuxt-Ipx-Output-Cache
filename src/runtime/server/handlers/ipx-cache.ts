import type { ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { Readable } from 'node:stream'

import type { H3Event } from 'h3'
import { defineEventHandler, sendStream, setHeaders, getHeader } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'

import type { ModuleOptions } from '../../../module'
import { createCache, type CacheStorage, type CachedData } from '../../utils/cache'
import { createCacheKey } from '../../utils/cache-key'
import { CaptureStream } from '../../utils/capture-stream'
import { createInflightMap } from '../../utils/inflight'

const PURGE_TOKEN_HEADER = 'x-ipx-purge-token'

// Lazily built once per process on the first matching request — keeps the
// cache/dedup state alive for the lifetime of this server instance.
let cache: CacheStorage | undefined
let inflight: ReturnType<typeof createInflightMap<CachedData>> | undefined
let ipxBaseURL: string | undefined
let purgeToken: string | undefined

function ensureInitialized(event: H3Event) {
  if (cache) return

  const config = useRuntimeConfig(event).ipxOutputCache as ModuleOptions & { ipxBaseURL: string }
  ipxBaseURL = config.ipxBaseURL
  purgeToken = config.purgeToken
  cache = createCache(config.cacheDir!, { memory: config.memoryCache })
  inflight = createInflightMap<CachedData>()
}

function hasValidPurgeToken(event: H3Event): boolean {
  if (!purgeToken) return false

  const provided = getHeader(event, PURGE_TOKEN_HEADER)
  if (!provided) return false

  const providedBuf = Buffer.from(provided)
  const expectedBuf = Buffer.from(purgeToken)
  if (providedBuf.length !== expectedBuf.length) return false

  return timingSafeEqual(providedBuf, expectedBuf)
}

/**
 * Patches the current request's res.write/res.end to capture the bytes the
 * real IPX handler (which runs right after this middleware falls through)
 * writes out, then resolves with them once the response ends. Must be
 * called synchronously — the caller returns immediately afterwards so h3
 * can proceed to the real handler on the same event.
 */
type WriteArgs = Parameters<ServerResponse['write']>
type EndArgs = Parameters<ServerResponse['end']>

function captureAndCache(
  event: H3Event,
  storageKey: string,
): Promise<CachedData> {
  return new Promise((resolve, reject) => {
    const res = event.node.res
    const capture = new CaptureStream()

    const originalWrite = res.write.bind(res)
    const originalEnd = res.end.bind(res)

    res.write = ((...args: WriteArgs): boolean => {
      const [chunk, encoding, callback] = args
      capture.write(chunk, encoding as BufferEncoding, callback as (error?: Error | null) => void)
      return (originalWrite as (...a: WriteArgs) => boolean)(...args)
    }) as ServerResponse['write']

    res.end = ((...args: EndArgs): ServerResponse => {
      const [chunk, encoding, callback] = args
      if (chunk) capture.write(chunk as Buffer | string, encoding as BufferEncoding, callback as (error?: Error | null) => void)

      const result = (originalEnd as (...a: EndArgs) => ServerResponse)(...args)

      if (res.statusCode !== 200) {
        reject(new Error(`[ipx-output-cache] upstream responded with ${res.statusCode}`))
        return result
      }

      const buffer = capture.getBuffer()
      const data: CachedData = {
        buffer,
        meta: { ...res.getHeaders(), 'content-length': buffer.byteLength },
      }

      setImmediate(() => {
        cache!.set(storageKey, data).catch((err) => {
          console.error('[ipx-output-cache] Failed to cache:', storageKey, err)
        })
      })

      resolve(data)
      return result
    }) as ServerResponse['end']
  })
}

export default defineEventHandler(async (event) => {
  ensureInitialized(event)

  // Nitro already scopes this handler to `ipxBaseURL` at registration time (route-based
  // middleware), and passes `event.path` with that mount prefix already stripped — so no
  // prefix check is needed (or possible) here.
  const { storageKey, bypass } = createCacheKey(event.path)
  if (bypass) return // no resolvable/negotiable format (e.g. `f_auto`) — never cache

  if (hasValidPurgeToken(event)) {
    await cache!.del(storageKey)
  }
  else {
    const cached = await cache!.get(storageKey)
    if (cached) {
      setHeaders(event, { ...cached.meta, 'cache-status': 'HIT' } as Record<string, string | number>)
      return sendStream(event, Readable.from(cached.buffer))
    }
  }

  const isFollower = inflight!.has(storageKey)
  const resultPromise = inflight!.once(storageKey, () => captureAndCache(event, storageKey))

  if (!isFollower) {
    // Leader: fall through so the real IPX handler runs on this (now-patched) event.
    resultPromise.catch(() => void 0)
    return
  }

  // Follower: wait for the leader's result and serve it directly.
  try {
    const result = await resultPromise
    setHeaders(event, { ...result.meta, 'cache-status': 'HIT' } as Record<string, string | number>)
    return sendStream(event, Readable.from(result.buffer))
  }
  catch {
    // Leader failed (error/non-200) — fall through and process independently.
    return
  }
})
