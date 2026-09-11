export default defineNuxtConfig({
  modules: ['@nuxt/image', '../src/module.ts'],
  devtools: { enabled: true },
  compatibilityDate: 'latest',  
  image: {
    provider: 'ipx',
    ipx: {
      baseURL: '/_taha'
    }
  },
  ipxOutputCache:{
    cacheDir: '.cache/ipx',
    clearCacheOnStart: false,
    enableCache: true
  }
})
