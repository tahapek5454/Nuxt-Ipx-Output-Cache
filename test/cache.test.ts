import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { setup, fetch } from '@nuxt/test-utils/e2e'

describe('ipx output cache', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  })

  it('MISSes on first request, then HITs on a repeat request with identical bytes', async () => {
    const path = '/_ipx/w_64,f_webp/tiger.jpg'

    const first = await fetch(path)
    expect(first.status).toBe(200)
    expect(first.headers.get('cache-status')).not.toBe('HIT')
    const firstBytes = Buffer.from(await first.arrayBuffer())

    const second = await fetch(path)
    expect(second.status).toBe(200)
    expect(second.headers.get('cache-status')).toBe('HIT')
    const secondBytes = Buffer.from(await second.arrayBuffer())

    expect(secondBytes.equals(firstBytes)).toBe(true)
  })

  it('caches different modifier combinations independently (no collisions)', async () => {
    const a = await fetch('/_ipx/w_32,f_webp/tiger.jpg')
    const b = await fetch('/_ipx/w_48,f_webp/tiger.jpg')

    expect(a.status).toBe(200)
    expect(b.status).toBe(200)

    const aBytes = Buffer.from(await a.arrayBuffer())
    const bBytes = Buffer.from(await b.arrayBuffer())
    expect(aBytes.equals(bBytes)).toBe(false)

    // repeat both — each must independently HIT its own cache entry
    const aAgain = await fetch('/_ipx/w_32,f_webp/tiger.jpg')
    const bAgain = await fetch('/_ipx/w_48,f_webp/tiger.jpg')
    expect(aAgain.headers.get('cache-status')).toBe('HIT')
    expect(bAgain.headers.get('cache-status')).toBe('HIT')
    expect(Buffer.from(await aAgain.arrayBuffer()).equals(aBytes)).toBe(true)
    expect(Buffer.from(await bAgain.arrayBuffer()).equals(bBytes)).toBe(true)
  })

  it('deduplicates a concurrent burst of identical never-before-seen requests', async () => {
    const path = '/_ipx/w_96,f_webp/tiger.jpg'

    const responses = await Promise.all(Array.from({ length: 8 }, () => fetch(path)))
    for (const res of responses) expect(res.status).toBe(200)

    const buffers = await Promise.all(responses.map(async res => Buffer.from(await res.arrayBuffer())))
    const first = buffers[0]!
    for (const buf of buffers) expect(buf.equals(first)).toBe(true)
  })

  it('bypasses caching entirely for f_auto (content-negotiated format)', async () => {
    const path = '/_ipx/f_auto/tiger.jpg'

    const first = await fetch(path)
    expect(first.status).toBe(200)
    expect(first.headers.get('cache-status')).not.toBe('HIT')

    const second = await fetch(path)
    expect(second.status).toBe(200)
    expect(second.headers.get('cache-status')).not.toBe('HIT')
  })

  it('does not let HEAD requests read or populate GET cache entries', async () => {
    const path = '/_ipx/w_72,f_webp/tiger.jpg'

    const head = await fetch(path, { method: 'HEAD' })
    expect(head.headers.get('cache-status')).not.toBe('HIT')

    const firstGet = await fetch(path)
    expect(firstGet.status).toBe(200)
    expect(firstGet.headers.get('cache-status')).not.toBe('HIT')

    const secondGet = await fetch(path)
    expect(secondGet.headers.get('cache-status')).toBe('HIT')
  })

  it('ignores an invalid purge token and still serves from cache', async () => {
    const path = '/_ipx/w_16,f_webp/tiger.jpg'
    await fetch(path) // populate cache

    const res = await fetch(path, { headers: { 'x-ipx-purge-token': 'wrong-token' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-status')).toBe('HIT')
  })

  it('purges and reprocesses when a valid purge token is presented', async () => {
    const path = '/_ipx/w_24,f_webp/tiger.jpg'
    await fetch(path) // populate cache
    const cached = await fetch(path)
    expect(cached.headers.get('cache-status')).toBe('HIT')

    const purged = await fetch(path, { headers: { 'x-ipx-purge-token': 'test-purge-token' } })
    expect(purged.status).toBe(200)
    expect(purged.headers.get('cache-status')).not.toBe('HIT')

    const rehit = await fetch(path)
    expect(rehit.headers.get('cache-status')).toBe('HIT')
  })
})
