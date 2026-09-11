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

describe('createCache priorityOnly gating', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ipx-cache-priority-test-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('never writes a non-priority entry into L1 when priorityOnly is enabled', async () => {
    const cache = createCache(dir, { memory: { priorityOnly: true } })
    const buffer = Buffer.from('non-priority bytes')

    await cache.set('webp:non-priority', { buffer, meta: {} }, { priority: false })
    rmSync(dir, { recursive: true, force: true }) // disk gone — only L1 could still serve it

    const result = await cache.get('webp:non-priority', { priority: false })
    expect(result).toBeUndefined()
  })

  it('still writes a priority entry into L1 when priorityOnly is enabled', async () => {
    const cache = createCache(dir, { memory: { priorityOnly: true } })
    const buffer = Buffer.from('priority bytes')

    await cache.set('webp:priority', { buffer, meta: {} }, { priority: true })
    rmSync(dir, { recursive: true, force: true }) // disk gone, L1 should still serve it

    const result = await cache.get('webp:priority', { priority: true })
    expect(result?.buffer.equals(buffer)).toBe(true)
  })

  it('does not promote a non-priority disk (L2) hit into L1 when priorityOnly is enabled', async () => {
    const cache = createCache(dir, { memory: { priorityOnly: true } })
    const buffer = Buffer.from('disk-only bytes')

    // Written without priority so it lands on disk only (per the previous test's behavior).
    await cache.set('webp:disk-only', { buffer, meta: {} }, { priority: false })

    const firstGet = await cache.get('webp:disk-only', { priority: false })
    expect(firstGet?.buffer.equals(buffer)).toBe(true)

    rmSync(dir, { recursive: true, force: true }) // if the first get() promoted it to L1, this would still serve it

    const secondGet = await cache.get('webp:disk-only', { priority: false })
    expect(secondGet).toBeUndefined()
  })

  it('caches everything (backward compatible) when priorityOnly is not set', async () => {
    const cache = createCache(dir)
    const buffer = Buffer.from('default behavior bytes')

    await cache.set('webp:default', { buffer, meta: {} })
    rmSync(dir, { recursive: true, force: true })

    const result = await cache.get('webp:default')
    expect(result?.buffer.equals(buffer)).toBe(true)
  })
})
