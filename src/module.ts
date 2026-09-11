import { defineNuxtModule, addServerPlugin, createResolver, hasNuxtModule, useLogger } from '@nuxt/kit'
import fs from 'node:fs';

export interface ModuleOptions {
  cacheDir?: string;
  enableCache?: boolean;
  clearCacheOnStart?: boolean;
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
  },
  async setup(opts, nuxt) {
    const logger = useLogger('ipx-output-cache');
    const { resolve } = createResolver(import.meta.url);
    
    if (!hasNuxtModule('@nuxt/image')) {
      logger.warn('@nuxt/image module is not installed. IPX Output Cache module will not be enabled.');
      logger.info('Install it with: npm install @nuxt/image or visit https://image.nuxt.com/');
      return;
    }

    const imageConfig = (nuxt.options as any).image || {};
    const provider = imageConfig.provider || 'ipx'; 
    
    if (provider !== 'ipx') {
      logger.warn(`IPX provider is not selected (current: ${provider}). IPX Output Cache module will not be enabled.`);
      logger.info('Set provider to "ipx" in your nuxt.config.ts: image: { provider: "ipx" }');
      return;
    }

    if( opts.enableCache === false ) {
      logger.info('IPX Output Cache is disabled via module options.');
      return;
    }

    logger.success('@nuxt/image with IPX provider detected. Enabling cache...');

    const ipxBaseURL = (imageConfig.ipx.baseURL as string) || '/_ipx';
    logger.success('Base url is ', ipxBaseURL);
    
    if(!opts.cacheDir) {
      opts.cacheDir = '.cache/ipx';
      logger.info(`No cacheDir specified. Using default: ${opts.cacheDir}`);
    }

    if (opts.clearCacheOnStart && fs.existsSync(opts.cacheDir)) {
      fs.rmSync(opts.cacheDir, { recursive: true, force: true });
      logger.info(`IPX cache cleared: ${opts.cacheDir}`);
    }

    nuxt.options.runtimeConfig.ipxOutputCache = {
      cacheDir: opts.cacheDir,
      enableCache: opts.enableCache,
      clearCacheOnStart: opts.clearCacheOnStart,
      ipxBaseURL: ipxBaseURL,
    };

    addServerPlugin(resolve('./runtime/server/plugin.ts'));
  },
})
