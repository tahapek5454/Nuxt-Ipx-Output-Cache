import { describe, it, expect } from 'vitest'
import { extractFormat, isAutoFormat, createCacheKey } from '../../src/runtime/utils/cache-key'

describe('extractFormat', () => {
  it('extracts an explicit f_ modifier', () => {
    expect(extractFormat('/_ipx/w_200,f_webp/image.jpg')).toBe('webp')
  })

  it('extracts an explicit format_ modifier', () => {
    expect(extractFormat('/_ipx/format_avif/image.jpg')).toBe('avif')
  })

  it('falls back to the source file extension', () => {
    expect(extractFormat('/_ipx/w_200/image.png')).toBe('png')
  })

  it('returns an empty string when nothing is resolvable', () => {
    expect(extractFormat('/_ipx/w_200/image')).toBe('')
  })
})

describe('isAutoFormat', () => {
  it('is case-insensitive', () => {
    expect(isAutoFormat('auto')).toBe(true)
    expect(isAutoFormat('AUTO')).toBe(true)
  })

  it('is false for concrete formats', () => {
    expect(isAutoFormat('webp')).toBe(false)
  })
})

describe('createCacheKey', () => {
  it('produces a stable key for the same path', () => {
    const a = createCacheKey('/_ipx/w_200,f_webp/image.jpg')
    const b = createCacheKey('/_ipx/w_200,f_webp/image.jpg')
    expect(a.storageKey).toBe(b.storageKey)
  })

  it('produces different keys for different modifiers', () => {
    const a = createCacheKey('/_ipx/w_200,f_webp/image.jpg')
    const b = createCacheKey('/_ipx/w_300,f_webp/image.jpg')
    expect(a.storageKey).not.toBe(b.storageKey)
  })

  it('bypasses caching when no format is resolvable', () => {
    const result = createCacheKey('/_ipx/w_200/image')
    expect(result.bypass).toBe(true)
  })

  it('bypasses caching for f_auto (content-negotiated format)', () => {
    const result = createCacheKey('/_ipx/f_auto/image.jpg')
    expect(result.bypass).toBe(true)
  })

  it('does not bypass when a concrete format is resolvable', () => {
    const result = createCacheKey('/_ipx/w_200,f_webp/image.jpg')
    expect(result.bypass).toBe(false)
  })

  it('never leaks path-traversal-ish or unsafe characters into the storage key', () => {
    const dangerous = [
      '/_ipx/w_200,f_webp/../../etc/passwd',
      '/_ipx/f_webp/https://evil.example.com/a?b=c&d=e',
      '/_ipx/f_webp/image:with:colons.jpg',
    ]

    for (const path of dangerous) {
      const { storageKey } = createCacheKey(path)
      expect(storageKey).toMatch(/^[\w-]+:[a-f0-9]{64}$/)
      expect(storageKey).not.toContain('..')
      expect(storageKey).not.toContain('/')
    }
  })

  it('strips the baseURL prefix so equivalent requests under different mounts still hash consistently', () => {
    const a = createCacheKey('/w_200,f_webp/image.jpg')
    const b = createCacheKey('/w_200,f_webp/image.jpg')
    expect(a.storageKey).toBe(b.storageKey)
  })
})
