import { createHash, timingSafeEqual } from 'node:crypto'
import type { OutgoingHttpHeaders } from 'node:http'
import { existsSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

const CACHEABLE_RESPONSE_HEADERS = new Set([
  'cache-control',
  'content-disposition',
  'content-type',
  'etag',
  'expires',
  'last-modified',
])

function isWithin(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path !== '' && path !== '..' && !path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(path)
}

/** Resolves cacheDir to a strict descendant of the Nuxt project root. */
export function resolveCacheDir(cacheDir: string, rootDir: string): string {
  const resolvedRoot = realpathSync.native(resolve(rootDir))
  const resolvedCacheDir = resolve(resolvedRoot, cacheDir)

  if (!isWithin(resolvedRoot, resolvedCacheDir)) {
    throw new Error('[ipx-output-cache] cacheDir must be a subdirectory of the Nuxt project root.')
  }

  // Resolve the nearest existing ancestor so an in-project symlink cannot redirect
  // clearing or disk writes outside the project boundary.
  let existingAncestor = resolvedCacheDir
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor)
    if (parent === existingAncestor) break
    existingAncestor = parent
  }

  const realAncestor = realpathSync.native(existingAncestor)
  if (realAncestor !== resolvedRoot && !isWithin(resolvedRoot, realAncestor)) {
    throw new Error('[ipx-output-cache] cacheDir must not resolve outside the Nuxt project root through a symlink.')
  }

  return resolvedCacheDir
}

/** Compares fixed-length digests so token length is not exposed by an early return. */
export function safeTokenEqual(provided: string | undefined, expected: string): boolean {
  const providedDigest = createHash('sha256').update(provided ?? '').digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(providedDigest, expectedDigest)
}

/** Keeps only headers that are safe and useful when replaying an image response. */
export function filterCacheHeaders(headers: OutgoingHttpHeaders): OutgoingHttpHeaders {
  const filtered: OutgoingHttpHeaders = {}

  for (const [name, value] of Object.entries(headers)) {
    if (CACHEABLE_RESPONSE_HEADERS.has(name.toLowerCase()) && value !== undefined) {
      filtered[name.toLowerCase()] = value
    }
  }

  return filtered
}
