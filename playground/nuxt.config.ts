export default defineNuxtConfig({
  modules: ['@nuxt/image', '../src/module.ts'],
  devtools: { enabled: true },
  compatibilityDate: 'latest',
  image: {
    provider: 'ipx',
    ipx: {
      baseURL: '/_taha',
    },
    // Named presets resolve to a fixed set of modifiers — each preset is cached
    // as its own independent entry, same as any other modifier combination.
    presets: {
      thumbnail: {
        modifiers: {
          format: 'webp',
          width: 120,
          height: 120,
          fit: 'cover',
        },
      },
    },
  },
  ipxOutputCache: {
    cacheDir: '.cache/ipx',
    clearCacheOnStart: true,
    enableCache: true,
    memoryCache: {
      enabled: true,
      maxItems: 100,
    },
    // Demo only — send `x-ipx-purge-token: playground-secret` to force a purge+reprocess.
    purgeToken: 'playground-secret',
  },
})
