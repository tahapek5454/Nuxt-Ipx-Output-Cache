import { defineNuxtModule, createResolver, hasNuxtModule, useLogger } from '@nuxt/kit'
import fs from 'node:fs'

// Minimal shape of `@nuxt/image`'s config we depend on (it's an optional peer,
// so we don't import its types directly).
interface NuxtImageModuleOptions {
  provider?: string
  ipx?: { baseURL?: string }
}

export interface ModuleOptions {
  cacheDir?: string
  enableCache?: boolean
  clearCacheOnStart?: boolean
  /** In-memory L1 cache in front of the disk cache. Enabled by default. */
  memoryCache?: {
    enabled?: boolean
    /** Max number of cached responses kept in memory (LRU eviction). Default 100. */
    maxItems?: number
  }
  /**
   * Secret required (via the `x-ipx-purge-token` request header) to force-purge a
   * single cached entry and reprocess it. Purge is fully disabled unless this is set.
   */
  purgeToken?: string
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'ipx-output-cache',
    configKey: 'ipxOutputCache',
    compatibility: { nuxt: '^3.x || ^4.x' },
  },
  defaults: {
    cacheDir: '.cache/ipx',
    enableCache: true,
    clearCacheOnStart: true,
    memoryCache: {
      enabled: true,
      maxItems: 100,
    },
  },
  async setup(opts, nuxt) {
    const logger = useLogger('ipx-output-cache')
    const { resolve } = createResolver(import.meta.url)

    if (!hasNuxtModule('@nuxt/image')) {
      logger.warn('@nuxt/image module is not installed. IPX Output Cache module will not be enabled.')
      logger.info('Install it with: npm install @nuxt/image or visit https://image.nuxt.com/')
      return
    }

    const imageConfig = ((nuxt.options as { image?: NuxtImageModuleOptions }).image) || {}
    const provider = imageConfig.provider || 'ipx'

    if (provider !== 'ipx') {
      logger.warn(`IPX provider is not selected (current: ${provider}). IPX Output Cache module will not be enabled.`)
      logger.info('Set provider to "ipx" in your nuxt.config.ts: image: { provider: "ipx" }')
      return
    }

    if (opts.enableCache === false) {
      logger.info('IPX Output Cache is disabled via module options.')
      return
    }

    logger.success('@nuxt/image with IPX provider detected. Enabling cache...')

    const ipxBaseURL = imageConfig.ipx?.baseURL || '/_ipx'
    logger.success('Base url is ', ipxBaseURL)

    if (!opts.cacheDir) {
      opts.cacheDir = '.cache/ipx'
      logger.info(`No cacheDir specified. Using default: ${opts.cacheDir}`)
    }

    if (opts.clearCacheOnStart && fs.existsSync(opts.cacheDir)) {
      fs.rmSync(opts.cacheDir, { recursive: true, force: true })
      logger.info(`IPX cache cleared: ${opts.cacheDir}`)
    }

    if (!opts.purgeToken) {
      logger.info('No purgeToken configured — manual cache purging via the x-ipx-purge-token header is disabled.')
    }

    nuxt.options.runtimeConfig.ipxOutputCache = {
      cacheDir: opts.cacheDir,
      enableCache: opts.enableCache ?? true,
      clearCacheOnStart: opts.clearCacheOnStart ?? true,
      memoryCache: {
        enabled: opts.memoryCache?.enabled ?? true,
        maxItems: opts.memoryCache?.maxItems ?? 100,
      },
      purgeToken: opts.purgeToken ?? '',
      ipxBaseURL: ipxBaseURL,
    }

    // Registered as a plain addServerHandler this would run AFTER @nuxt/image's own
    // IPX handler (its setup already ran, since hasNuxtModule() above requires it).
    // We unshift it onto nitro's handlers instead, so it is the FIRST layer h3 checks
    // per-request — the only point where a cache HIT can reliably short-circuit before
    // the real (expensive) IPX/sharp handler ever runs. See .github/copilot-instructions.md.
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.handlers ||= []
      nitroConfig.handlers.unshift({
        route: ipxBaseURL,
        handler: resolve('./runtime/server/handlers/ipx-cache.ts'),
        middleware: true,
      })
    })
  },
})
