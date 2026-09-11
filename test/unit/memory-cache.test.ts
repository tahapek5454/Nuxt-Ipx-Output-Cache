import { describe, it, expect } from 'vitest'
import { createMemoryCache } from '../../src/runtime/utils/memory-cache'

describe('createMemoryCache', () => {
  it('returns undefined for a missing key', () => {
    const cache = createMemoryCache<string>()
    expect(cache.get('missing')).toBeUndefined()
  })

  it('stores and retrieves a value', () => {
    const cache = createMemoryCache<string>()
    cache.set('a', 'value-a')
    expect(cache.get('a')).toBe('value-a')
  })

  it('evicts the least recently used entry once over maxItems', () => {
    const cache = createMemoryCache<string>({ maxItems: 2 })
    cache.set('a', '1')
    cache.set('b', '2')
    cache.set('c', '3') // should evict 'a'

    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe('2')
    expect(cache.get('c')).toBe('3')
  })

  it('bumps recency on get, protecting recently-read entries from eviction', () => {
    const cache = createMemoryCache<string>({ maxItems: 2 })
    cache.set('a', '1')
    cache.set('b', '2')
    cache.get('a') // 'a' is now more recent than 'b'
    cache.set('c', '3') // should evict 'b', not 'a'

    expect(cache.get('a')).toBe('1')
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBe('3')
  })

  it('del removes a single entry', () => {
    const cache = createMemoryCache<string>()
    cache.set('a', '1')
    cache.del('a')
    expect(cache.get('a')).toBeUndefined()
  })

  it('clear removes all entries', () => {
    const cache = createMemoryCache<string>()
    cache.set('a', '1')
    cache.set('b', '2')
    cache.clear()
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeUndefined()
  })

  it('defaults maxItems to 100', () => {
    const cache = createMemoryCache<number>()
    for (let i = 0; i < 100; i++) cache.set(`k${i}`, i)
    cache.set('k100', 100) // 101st entry, should evict k0 (oldest, untouched)
    expect(cache.get('k0')).toBeUndefined()
    expect(cache.get('k100')).toBe(100)
  })
})
