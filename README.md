# Nuxt IPX Output Cache

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Cache [`@nuxt/image`](https://image.nuxt.com)'s IPX-processed output (resized/reformatted/recompressed
images) so repeated requests do not have to go through `sharp`/IPX again.

The module is compatible with Nuxt 3 and Nuxt 4 and is designed for applications using the IPX
provider. It requires no application code changes beyond the module configuration.

- [✨ &nbsp;Release Notes](https://github.com/tahapek5454/nuxt-ipx-output-cache/releases)

## Features

- 🧠 **Two-tier cache** — an in-memory LRU (L1, per-process, instant) in front of a persistent
  on-disk store (L2, survives restarts). Reads check L1 first, promote L2 hits back into L1;
  writes update both.
- 🧵 **Request coalescing** — concurrent requests for the same never-before-cached image share a
  single IPX/`sharp` processing pass ("leader/follower"); no thundering herd, no duplicated CPU work.
- 🔒 **Safe cache keys** — every key is SHA-256 hashed before touching the filesystem, so nothing in
  a URL (traversal sequences, remote URLs, arbitrary characters) can escape into an unsafe path.
- 🖼️ **Content-negotiation aware** — `format: 'auto'` / `f_auto` requests (where IPX picks the best
  format per client `Accept` header) are never cached, so one client's negotiated format is never
  served to another client that doesn't support it.
- 🗑️ **Optional secured purge** — configure a `purgeToken` and send it via the `x-ipx-purge-token`
  header to force a single entry to be purged and reprocessed. Disabled by default; without a
  configured token the header is ignored entirely.
- 🚫 No cross-server/shared cache — each server process/replica keeps its own independent cache
  (no Redis, no shared volume required). Safe for horizontally-scaled deployments; nothing more to
  configure.

## Quick Setup

Install the module to your Nuxt application:

```bash
npx nuxt module add nuxt-ipx-output-cache
```

Requires [`@nuxt/image`](https://image.nuxt.com) with `provider: 'ipx'` (the default). The module
detects this automatically at build time and no-ops (with a warning) if `@nuxt/image` isn't
installed or a different provider is selected.

For a manual installation, install both packages in the Nuxt application:

```bash
npm install nuxt-ipx-output-cache @nuxt/image
```

## Configuration

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/image', 'nuxt-ipx-output-cache'],
  image: { provider: 'ipx' },
  ipxOutputCache: {
    // Directory the on-disk (L2) cache is persisted to.
    cacheDir: '.cache/ipx',
    // Master on/off switch for the whole module.
    enableCache: true,
    // Wipe cacheDir once at server start (useful in dev; usually false in production).
    clearCacheOnStart: true,
    // Responses larger than this are served normally but not retained (default: 50 MiB).
    maxResponseSize: 50 * 1024 * 1024,
    memoryCache: {
      // In-memory (L1) LRU layer in front of the disk cache.
      enabled: true,
      // Max number of responses kept in memory before the least-recently-used entry is evicted.
      maxItems: 100,
      // Optional: only requests marked with the priority modifier use L1 memory.
      // Disk caching remains enabled for all cacheable requests.
      priorityOnly: false,
      // Modifier key used by priorityOnly. Must contain 1-64 letters, numbers, _ or -.
      priorityModifier: 'priority',
    },
    // Set this to enable purging. Leave unset to fully disable the purge endpoint/header.
    purgeToken: undefined,
  },
})
```

### Configuration reference

All options are nested under `ipxOutputCache`. The values below are the module defaults.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `cacheDir` | `string` | `'.cache/ipx'` | L2 filesystem cache directory, resolved below the Nuxt project root. |
| `enableCache` | `boolean` | `true` | Disables the module's cache handling when set to `false`. |
| `clearCacheOnStart` | `boolean` | `true` | Removes the cache directory when the server starts. Set to `false` in production when you want to reuse the disk cache across restarts. |
| `maxResponseSize` | `number` | `52428800` | Maximum cached response size in bytes (50 MiB). Larger responses are served but not retained. Must be a positive safe integer. |
| `purgeToken` | `string` | unset | Enables token-gated purge requests. It is never enabled unless a non-empty token is configured. |
| `memoryCache.enabled` | `boolean` | `true` | Enables the per-process L1 memory cache. |
| `memoryCache.maxItems` | `number` | `100` | Maximum number of entries in the L1 LRU cache. |
| `memoryCache.priorityOnly` | `boolean` | `false` | Stores/promotes only priority-marked requests in L1. L2 disk caching is unaffected. |
| `memoryCache.priorityModifier` | `string` | `'priority'` | Modifier name used to mark a request as priority. |

`cacheDir` must be a strict subdirectory of the Nuxt project root. This restriction prevents a
misconfiguration from clearing or writing outside the application directory. Use a writable path
that is persistent enough for your deployment. The cache is an optimization, so deleting it is
always safe.

### Priority-only memory caching

The optional priority mode is useful when the L1 memory budget should be reserved for important
images while all other images continue to use the persistent L2 cache. Mark a request with the
configured modifier in its IPX modifiers:

```vue
<NuxtImg
  src="/images/hero.jpg"
  width="1200"
  format="webp"
  :modifiers="{ priority: true }"
  alt="Hero image"
/>
```

With `priorityOnly: true`, priority requests are eligible for the fast L1 cache. Non-priority
requests are still written to and read from disk, but are not retained in memory. The priority
flag is removed when the cache key is generated, so adding or removing the flag does not create a
second disk-cache entry for the same image variant.

If a different modifier name is preferred, configure it in both places:

```ts
ipxOutputCache: {
  memoryCache: {
    priorityOnly: true,
    priorityModifier: 'hot',
  },
}
```

The module augments `@nuxt/image`'s IPX modifier type automatically, so the configured modifier
can be used in typed Vue templates without a separate declaration file.

### Purging a cached image

With a `purgeToken` configured, send the header on any request to that image's URL to force a
fresh reprocess:

```bash
curl -H "x-ipx-purge-token: <your-token>" "https://your-site.com/_ipx/w_300,f_webp/photo.jpg"
```

Requests without the header (or with the wrong value) are unaffected and continue to be served
from cache normally — the header is just ignored if it doesn't match.

The purge token should be provided through a deployment secret rather than committed to source
control. Purging is deliberately request-scoped: it removes only the cache entry represented by
the requested IPX URL, then lets IPX generate that response again.

### Cache status

Successful responses served directly from either cache tier include:

```text
cache-status: HIT
```

A first request, a purged request, an uncached `f_auto` request, a non-`GET` request, or a response
that exceeds `maxResponseSize` does not receive `cache-status: HIT`. This makes the header useful
for debugging and lightweight observability, but it is not a replacement for application metrics.

## How it works

`@nuxt/image`'s `ipx` provider generates URLs like `/_ipx/w_300,f_webp,q_80/photo.jpg`. Normally,
every request to a URL like that re-runs the full IPX/`sharp` pipeline, even for byte-identical
repeat requests.

This module registers a server middleware that runs **first**, ahead of `@nuxt/image`'s own IPX
handler (via `nitro:config`'s `handlers.unshift(...)`, which guarantees first position in Nitro's
request-handling stack regardless of module registration order):

1. Compute a safe (hashed) cache key from the request path.
2. If the request can't be safely cached (no resolvable format, or `format: 'auto'`), pass through
   untouched — nothing is read or written.
3. On a cache **hit**, stream the cached bytes back immediately (`cache-status: HIT` header) — the
   real IPX handler never runs.
4. On a cache **miss**, fall through so the real IPX handler runs, but first patch the response so
   the bytes it writes are captured, cached (both tiers), and shared with any other concurrent
   request for that exact same key (via an in-flight/promise-based dedup map) instead of each one
   reprocessing independently.

Only `GET` requests participate in the cache. `HEAD` and other methods always pass through and do
not read or populate a `GET` entry. Cache keys include the complete IPX path and modifiers, so
different sizes, formats, qualities, and source paths are stored independently.

> **Note:** an earlier version of this module tried to intercept requests via Nitro's `"request"`
> hook. That hook fires before Nitro's handler stack runs its `event.handled` check, so it cannot
> *reliably* short-circuit before the real IPX handler executes — worst case, the cache is
> effectively bypassed, or a response gets written to twice. Using a real first-in-stack
> server middleware (this module's current approach) is the only point that's provably safe.

## Production notes

- `cacheDir` is resolved under the Nuxt project root and must be a strict subdirectory. This keeps
  startup cache clearing from targeting the project root or paths outside it.
- The response-size limit is per cached image. The disk tier does not enforce a total quota; use a
  dedicated volume/quota and normal disk monitoring for public deployments with unbounded variants.
- Cache reads/writes only apply to `GET`. `f_auto` remains intentionally uncached because its bytes
  vary with `Accept`; mitigate abusive uncached image traffic at your CDN/reverse proxy if needed.
- Each server process/replica maintains its own independent cache (memory + disk). There is no
  shared/cross-instance cache — this is a deliberate choice for simplicity and to avoid a network
  round-trip (e.g. Redis) on every image request. If you run multiple replicas behind a load
  balancer, expect each one to build up its own cache independently (normal, and still eliminates
  the duplicate-processing cost per-instance).
- `cacheDir` should point at writable, persistent-enough storage for your deployment (ephemeral
  containers will just rebuild the disk cache from empty on restart, which is fine — the L1 memory
  cache still protects against bursts of repeat requests during the process's lifetime).
- Keep `clearCacheOnStart: true` for local development if you want deterministic results. For a
  production deployment, the usual setting is `false`; otherwise every restart deliberately
  removes the L2 cache before it can be reused.
- If you customize `image.ipx.baseURL`, the module follows that route automatically. No matching
  `ipxBaseURL` option is needed in `ipxOutputCache`.
- `@nuxt/image` must be listed before this module in `modules` when using the normal Nuxt setup:
  `modules: ['@nuxt/image', 'nuxt-ipx-output-cache']`. The module also verifies that the active
  provider is `ipx` before registering its handler.

## Troubleshooting

### The module says it is disabled

Check that `@nuxt/image` is installed and that the active provider is IPX:

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/image', 'nuxt-ipx-output-cache'],
  image: { provider: 'ipx' },
})
```

`enableCache: false` also intentionally disables the module. The module logs the reason during
Nuxt setup.

### Every request is a miss

Confirm that the request is a `GET`, uses a concrete format such as `f_webp` or a source extension,
and is not using `f_auto`. Check that `cacheDir` is writable and that `clearCacheOnStart` is not
clearing the directory on every process start. A response larger than `maxResponseSize` is also
never retained.

### The cache grows unexpectedly

The module limits each cached response, not the total disk-cache size. IPX creates a distinct entry
for each modifier combination. Configure a filesystem quota or a scheduled cleanup policy for
deployments with many unbounded image variants.

## Publishing and release checklist

Before publishing a release, run the same checks used by the package release script:

```bash
npm run lint
npm run test:types
npm run test
npm run prepack
```

Then review the generated package contents and version/changelog, and publish from a clean Git
working tree. The package exports the built module from `dist/`; source files are not required by
consumers. The repository's release script runs linting, tests, the package build, changelog
generation, `npm publish`, and tag pushing in sequence.

For local development, use `npm run dev:prepare` after changing module options or generated type
templates so Nuxt's generated types are refreshed before running type checks.

## Contribution

<details>
  <summary>Local development</summary>

  ```bash
  # Install dependencies
  npm install

  # Generate type stubs
  npm run dev:prepare

  # Develop with the playground
  npm run dev

  # Build the playground
  npm run dev:build

  # Run ESLint
  npm run lint

  # Run Vitest
  npm run test
  npm run test:watch

  # Check Nuxt and playground types
  npm run test:types

  # Build the publishable dist/ directory
  npm run prepack

  # Release new version
  npm run release
  ```

</details>

## License

[MIT](https://opensource.org/license/mit/)


<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/nuxt-ipx-output-cache/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/nuxt-ipx-output-cache

[npm-downloads-src]: https://img.shields.io/npm/dm/nuxt-ipx-output-cache.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/nuxt-ipx-output-cache

[license-src]: https://img.shields.io/npm/l/nuxt-ipx-output-cache.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/nuxt-ipx-output-cache

[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt
[nuxt-href]: https://nuxt.com
