<template>
  <main class="page">
    <h1>Responsive Nuxt Image + IPX cache</h1>
    <p>
      Pencereyi yeniden boyutlandır. <code>width</code> ve <code>height</code> görselin
      en-boy oranını önceden ayırır; ekrandaki gerçek boyutu aşağıdaki CSS belirler.
      <code>sizes</code> ise tarayıcıya hangi <code>srcset</code> adayını indireceğini söyler.
    </p>

    <NuxtImg
      v-slot="{ src, imgAttrs }"
      custom
      src="/tiger.jpg"
      format="webp"
      width="400"
      height="400"
      sizes="xs:100vw sm:200px xl:400px"
      densities="1x 2x"
      alt="Responsive tiger image"
    >
      <img
        ref="responsiveImage"
        v-bind="imgAttrs"
        :src="src"
        class="responsive-image"
        @load="updateImageInfo"
      >
    </NuxtImg>

    <dl class="image-info">
      <div>
        <dt>Viewport</dt>
        <dd>{{ viewportWidth }} px</dd>
      </div>
      <div>
        <dt>Çizilen genişlik</dt>
        <dd>{{ renderedWidth }} px</dd>
      </div>
      <div>
        <dt>İndirilen dosya genişliği</dt>
        <dd>{{ naturalWidth }} px</dd>
      </div>
      <div>
        <dt>Tarayıcının seçtiği URL (currentSrc)</dt>
        <dd><code>{{ currentSrc || 'Henüz yüklenmedi' }}</code></dd>
      </div>
    </dl>

    <h2>Nuxt Image çıktısı</h2>
    <p><code>sizes</code>: {{ generated.sizes }}</p>
    <p class="breakable"><code>srcset</code>: {{ generated.srcset }}</p>

    <h2>Her adayın cache durumu</h2>
    <p>
      Tarayıcı bu listenin tamamını tek istekte üretmez; ekran genişliği ve DPR için uygun
      olan yalnızca bir adayı ister. Her farklı IPX URL'si modülde bağımsız cache girdisidir.
      Tarayıcının sayfa açılırken seçtiği aday zaten cache'lenmiş olabileceği için ilk kontrolde
      HIT görebilirsin. Henüz istenmeyen aday ise ilk kontrolde MISS, ikincide HIT olur.
    </p>
    <ul class="candidate-list">
      <li v-for="candidate in candidates" :key="candidate.url">
        <code>{{ candidate.descriptor }}</code>
        <button type="button" @click="checkCache(candidate.url)">
          Cache'i kontrol et
        </button>
        <strong>{{ cacheStatuses[candidate.url] }}</strong>
        <code class="breakable">{{ candidate.url }}</code>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
const image = useImage()
const responsiveImage = ref<HTMLImageElement | null>(null)
const viewportWidth = ref(0)
const renderedWidth = ref(0)
const naturalWidth = ref(0)
const currentSrc = ref('')
const cacheStatuses = ref<Record<string, string>>({})

const generated = computed(() => image.getSizes('/tiger.jpg', {
  sizes: 'xs:100vw sm:200px xl:400px',
  densities: '1x 2x',
  modifiers: {
    width: 400,
    height: 400,
    format: 'webp',
  },
}))

const candidates = computed(() => generated.value.srcset.split(', ').map((entry) => {
  const separator = entry.lastIndexOf(' ')
  return {
    url: entry.slice(0, separator),
    descriptor: entry.slice(separator + 1),
  }
}))

function updateImageInfo() {
  viewportWidth.value = window.innerWidth
  renderedWidth.value = Math.round(responsiveImage.value?.getBoundingClientRect().width || 0)
  naturalWidth.value = responsiveImage.value?.naturalWidth || 0
  currentSrc.value = responsiveImage.value?.currentSrc || ''
}

async function checkCache(path: string) {
  const response = await $fetch.raw(path)
  cacheStatuses.value[path] = response.headers.get('cache-status') || 'MISS (cache şimdi oluşturuldu)'
}

onMounted(() => {
  updateImageInfo()
  window.addEventListener('resize', updateImageInfo)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateImageInfo)
})
</script>

<style scoped>
.page {
  max-width: 70rem;
  margin: 0 auto;
  padding: 1.5rem;
  font-family: system-ui, sans-serif;
}

.responsive-image {
  display: block;
  width: 400px;
  height: auto;
  max-width: 100%;
  border-radius: 0.75rem;
}

.image-info {
  display: grid;
  gap: 0.75rem;
  margin-block: 1.5rem;
}

.image-info div {
  display: grid;
  grid-template-columns: minmax(10rem, 14rem) 1fr;
  gap: 0.5rem;
}

.image-info dt {
  font-weight: 700;
}

.image-info dd {
  min-width: 0;
  margin: 0;
}

.candidate-list {
  display: grid;
  gap: 1rem;
  padding: 0;
  list-style: none;
}

.candidate-list li {
  display: grid;
  grid-template-columns: 4rem auto 1fr;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
}

.candidate-list .breakable {
  grid-column: 1 / -1;
}

.breakable {
  overflow-wrap: anywhere;
}

@media (width <= 640px) {
  .responsive-image {
    width: 100%;
  }

  .candidate-list li {
    grid-template-columns: 1fr;
  }

  .candidate-list .breakable {
    grid-column: auto;
  }
}

@media (640px < width <= 1280px) {
  .responsive-image {
    width: 200px;
  }
}
</style>