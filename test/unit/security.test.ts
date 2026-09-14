import { mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { filterCacheHeaders, resolveCacheDir, safeTokenEqual } from '../../src/runtime/utils/security'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('resolveCacheDir', () => {
  it('resolves a relative cache directory under the project root', () => {
    const root = mkdtempSync(join(tmpdir(), 'ipx-root-'))
    dirs.push(root)
    expect(resolveCacheDir('.cache/ipx', root)).toBe(join(realpathSync.native(root), '.cache', 'ipx'))
  })

  it('rejects the project root and paths outside it', () => {
    const root = mkdtempSync(join(tmpdir(), 'ipx-root-'))
    dirs.push(root)
    expect(() => resolveCacheDir('.', root)).toThrow('subdirectory')
    expect(() => resolveCacheDir('..', root)).toThrow('subdirectory')
    expect(() => resolveCacheDir(tmpdir(), root)).toThrow('subdirectory')
  })

  it.runIf(process.platform !== 'win32')('rejects an existing symlink that escapes the project root', () => {
    const root = mkdtempSync(join(tmpdir(), 'ipx-root-'))
    const outside = mkdtempSync(join(tmpdir(), 'ipx-outside-'))
    dirs.push(root, outside)
    symlinkSync(outside, join(root, 'cache-link'), 'dir')

    expect(() => resolveCacheDir('cache-link/ipx', root)).toThrow('symlink')
  })
})

describe('safeTokenEqual', () => {
  it('accepts only the exact token, including its length', () => {
    expect(safeTokenEqual('correct-token', 'correct-token')).toBe(true)
    expect(safeTokenEqual('wrong-token', 'correct-token')).toBe(false)
    expect(safeTokenEqual(undefined, 'correct-token')).toBe(false)
  })
})

describe('filterCacheHeaders', () => {
  it('keeps image metadata and drops stateful or unsafe headers', () => {
    expect(filterCacheHeaders({
      'Content-Type': 'image/webp',
      'cache-control': 'public, max-age=60',
      'set-cookie': 'session=attacker',
      'location': 'https://example.invalid',
      'connection': 'keep-alive',
    })).toEqual({
      'content-type': 'image/webp',
      'cache-control': 'public, max-age=60',
    })
  })
})
