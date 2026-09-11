import MyModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    '@nuxt/image',
    MyModule,
  ],
  compatibilityDate: 'latest',
  image: {
    provider: 'ipx',
  },
  ipxOutputCache: {
    cacheDir: '.cache/ipx-test',
    clearCacheOnStart: true,
    purgeToken: 'test-purge-token',
  },
})
