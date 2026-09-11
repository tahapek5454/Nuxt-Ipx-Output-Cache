import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createCache } from '../../src/runtime/utils/cache'

describe('createCache (L1/L2 facade)', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ipx-cache-test-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('round-trips a buffer + meta written via set() through get(), byte for byte', async () => {
    const cache = createCache(dir)
    const buffer = Buffer.from('hello world')

    await cache.set('webp:deadbeef', { buffer, meta: { 'content-type': 'image/webp' } })
    const result = await cache.get('webp:deadbeef')

    expect(result).toBeDefined()
    expect(result!.buffer.equals(buffer)).toBe(true)
    expect(result!.meta['content-type']).toBe('image/webp')
  })

  it('serves from memory (L1) without touching disk on a second get()', async () => {
    const cache = createCache(dir)
    const buffer = Buffer.from('cached bytes')

    await cache.set('webp:cafebabe', { buffer, meta: {} })
    rmSync(dir, { recursive: true, force: true }) // disk gone, memory should still serve

    const result = await cache.get('webp:cafebabe')
    expect(result?.buffer.equals(buffer)).toBe(true)
  })

  it('returns undefined for a never-written key', async () => {
    const cache = createCache(dir)
    const result = await cache.get('webp:doesnotexist')
    expect(result).toBeUndefined()
  })
})
