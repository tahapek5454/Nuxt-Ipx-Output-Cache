import { describe, it, expect, vi } from 'vitest'
import { createInflightMap } from '../../src/runtime/utils/inflight'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('createInflightMap', () => {
  it('has() is false before any call and true while a factory is pending', async () => {
    const inflight = createInflightMap<string>()
    const d = deferred<string>()

    expect(inflight.has('key')).toBe(false)
    const p = inflight.once('key', () => d.promise)
    expect(inflight.has('key')).toBe(true)

    d.resolve('done')
    await p
  })

  it('calls the factory exactly once for concurrent calls with the same key', async () => {
    const inflight = createInflightMap<string>()
    const factory = vi.fn(() => new Promise<string>(resolve => setTimeout(() => resolve('result'), 10)))

    const [a, b, c] = await Promise.all([
      inflight.once('key', factory),
      inflight.once('key', factory),
      inflight.once('key', factory),
    ])

    expect(factory).toHaveBeenCalledTimes(1)
    expect(a).toBe('result')
    expect(b).toBe('result')
    expect(c).toBe('result')
  })

  it('cleans up after settling so a later call re-triggers the factory', async () => {
    const inflight = createInflightMap<string>()
    const factory = vi.fn(() => Promise.resolve('result'))

    await inflight.once('key', factory)
    expect(inflight.has('key')).toBe(false)

    await inflight.once('key', factory)
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('rejects all concurrent waiters when the factory fails, and cleans up the map', async () => {
    const inflight = createInflightMap<string>()
    const factory = vi.fn(() => Promise.reject(new Error('boom')))

    const results = await Promise.allSettled([
      inflight.once('key', factory),
      inflight.once('key', factory),
    ])

    expect(factory).toHaveBeenCalledTimes(1)
    expect(results[0].status).toBe('rejected')
    expect(results[1].status).toBe('rejected')
    expect(inflight.has('key')).toBe(false)
  })

  it('keeps different keys fully independent', async () => {
    const inflight = createInflightMap<string>()
    const factoryA = vi.fn(() => Promise.resolve('a'))
    const factoryB = vi.fn(() => Promise.resolve('b'))

    const [a, b] = await Promise.all([
      inflight.once('key-a', factoryA),
      inflight.once('key-b', factoryB),
    ])

    expect(a).toBe('a')
    expect(b).toBe('b')
    expect(factoryA).toHaveBeenCalledTimes(1)
    expect(factoryB).toHaveBeenCalledTimes(1)
  })
})
