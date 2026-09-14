<!--
Get your module up and running quickly.

Find and replace all on all files (CMD+SHIFT+F):
- Name: IPX Output Cache
- Package name: ipx-output-cache
- Description: IPX Output Cache Module for Nuxt
-->

# IPX Output Cache

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Cache [`@nuxt/image`](https://image.nuxt.com)'s IPX-processed output (resized/reformatted/recompressed
images) so the same request never has to go through `sharp`/IPX twice.

- [✨ &nbsp;Release Notes](/CHANGELOG.md)

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
npx nuxt module add ipx-output-cache
```

Requires [`@nuxt/image`](https://image.nuxt.com) with `provider: 'ipx'` (the default). The module
detects this automatically at build time and no-ops (with a warning) if `@nuxt/image` isn't
installed or a different provider is selected.

## Configuration

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/image', 'ipx-output-cache'],
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
    },
    // Set this to enable purging. Leave unset to fully disable the purge endpoint/header.
    purgeToken: undefined,
  },
})
```

### Purging a cached image

With a `purgeToken` configured, send the header on any request to that image's URL to force a
fresh reprocess:

```bash
curl -H "x-ipx-purge-token: <your-token>" "https://your-site.com/_ipx/w_300,f_webp/photo.jpg"
```

Requests without the header (or with the wrong value) are unaffected and continue to be served
from cache normally — the header is just ignored if it doesn't match.

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

  # Release new version
  npm run release
  ```

</details>


<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/ipx-output-cache/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/ipx-output-cache

[npm-downloads-src]: https://img.shields.io/npm/dm/ipx-output-cache.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/ipx-output-cache

[license-src]: https://img.shields.io/npm/l/ipx-output-cache.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/ipx-output-cache

[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt
[nuxt-href]: https://nuxt.com
