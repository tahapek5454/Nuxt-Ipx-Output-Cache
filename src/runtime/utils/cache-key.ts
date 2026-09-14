import { createHash } from 'node:crypto'

/**
 * Extract the IPX output format from a request path: an explicit `f_x`/`format_x`
 * modifier wins, otherwise falls back to the source file's extension.
 */
export function extractFormat(url: string): string {
  const formatMatch = url.match(/f(?:ormat)?[_-](\w+)/)
  if (formatMatch?.[1]) {
    return formatMatch[1]
  }

  const extMatch = url.match(/\.(\w+)(?:[?&#]|$)/)
  if (extMatch?.[1]) {
    return extMatch[1]
  }

  return ''
}

export function isAutoFormat(format: string): boolean {
  return format.toLowerCase() === 'auto'
}

export interface CacheKeyResult {
  /** Filesystem/unstorage-safe key: `${format}:${sha256}`, never contains the raw path. */
  storageKey: string
  format: string
  /**
   * True when this request must never be cached — e.g. no resolvable format, or
   * `f_auto` whose output depends on the client's `Accept` header and would
   * otherwise leak one client's negotiated format to every other client.
   */
  bypass: boolean
  /** True when the request carries the priority modifier flag (see `CreateCacheKeyOptions`). */
  priority: boolean
}

export interface CreateCacheKeyOptions {
  /** IPX modifier key that flags a request as high-priority for the in-memory cache. Default `'priority'`. */
  priorityModifierKey?: string
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function createCacheKey(path: string, options: CreateCacheKeyOptions = {}): CacheKeyResult {
  const priorityKey = `${escapeRegExp(options.priorityModifierKey || 'priority')}_true`
  const priorityFalseKey = `${escapeRegExp(options.priorityModifierKey || 'priority')}_false`

  // Flag modifiers (e.g. `f_webp&priority_true`) appear bare, with no value — bounded so
  // e.g. `priorityHigh` never false-matches.
  const priority = new RegExp(`(?:^|[,&/])${priorityKey}(?=[,&/]|$)`).test(path)

  const format = extractFormat(path)
  const bypass = format === '' || isAutoFormat(format)

  // Strip the flag (plus one adjacent separator, or both `/` if it's alone in its
  // segment) before hashing, so the same image hashes identically with or without it.
  let withoutPriority = path.replace(
    new RegExp(`${priorityKey}[,&]|[,&]${priorityKey}(?=[,&/]|$)|(?<=/)${priorityKey}(?=/)`, 'g'),
    '',
  )
  withoutPriority = withoutPriority.replace(
    new RegExp(`${priorityFalseKey}[,&]|[,&]${priorityFalseKey}(?=[,&/]|$)|(?<=/)${priorityFalseKey}(?=/)`, 'g'),
    '',
  )

  const normalized = withoutPriority
    .replace(/,/g, '')
    .replace(/https?:\/\//g, '')
    .replace(/&/g, '-')

  // Hashing (instead of using `normalized` directly as a storage key) prevents path
  // traversal / invalid filesystem characters / key collisions from reaching the
  // disk driver, regardless of what a source URL or modifier string contains.
  const hash = createHash('sha256').update(normalized).digest('hex')
  const storageKey = `${format || 'raw'}:${hash}`

  return { storageKey, format, bypass, priority }
}
