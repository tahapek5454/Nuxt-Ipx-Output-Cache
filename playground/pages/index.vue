<template>
    <div>
        <h1>Nuxt ipx output cache playground</h1>
        <p>
            Her örneğin altındaki "Cache durumu" butonuna tıklayıp aynı görsele arka arkaya
            basarak <code>cache-status</code> header'ının ilk seferde boş, sonraki isteklerde
            <code>HIT</code> döndüğünü gözlemleyebilirsin.
        </p>

        <h2>1. Düz &lt;img&gt; etiketi (modülden etkilenmez, IPX kullanmaz)</h2>
        <img src="/tiger.jpg" width="300" height="300" alt="tiger image default img tag">

        <hr>

        <h2>2. Format / quality / fit</h2>
        <p>format, quality ve fit modifier'ları — her farklı kombinasyon kendi cache anahtarını üretir.</p>
        <NuxtImg :key="cacheBuster" src="/tiger.jpg" format="avif" width="300" height="300" fit="cover" :quality="80"
            alt="tiger image - avif/cover/quality 80" />
        <CacheStatusButton :path="formatExamplePath" />

        <hr>

        <h2>3. Densities (retina/2x/3x) — her yoğunluk ayrı bir istek, ayrı bir cache girdisi</h2>
        <NuxtImg src="/tiger.jpg" width="150" height="150" densities="1x 2x" alt="tiger image with densities" />

        <hr>

        <h2>4. Sizes (responsive) — breakpoint başına farklı genişlik, farklı cache anahtarı</h2>
        <NuxtImg src="/tiger.jpg" sizes="100vw sm:200px md:300px" alt="tiger image with sizes" />

        <hr>

        <h2>5. Preset (nuxt.config.ts → image.presets.thumbnail)</h2>
        <NuxtImg src="/tiger.jpg" preset="thumbnail" alt="tiger image via thumbnail preset" />
        <CacheStatusButton :path="presetExamplePath" />

        <hr>

        <h2>6. modifiers prop (serbest IPX modifier'ları)</h2>
        <NuxtImg src="/tiger.jpg" :modifiers="{ blur: 5, grayscale: true }" width="200"
            alt="tiger image with raw modifiers" />

        <hr>

        <h2>7. f_auto (içerik pazarlığı) — asla cache'lenmez</h2>
        <p>
            İstemcinin <code>Accept</code> header'ına göre en iyi formatı IPX seçer; bu yanıt
            istemciden istemciye değişebileceği için modül bu isteği kasıtlı olarak
            cache'lemeden (bypass) geçirir.
        </p>
        <NuxtImg src="/tiger.jpg" format="auto" width="200" alt="tiger image with auto format" />
        <CacheStatusButton :path="autoFormatExamplePath" />

        <hr>

        <h2>8. Purge (geçersiz kılma)</h2>
        <p>
            <code>ipxOutputCache.purgeToken</code> tanımlıysa, <code>x-ipx-purge-token</code>
            header'ı doğru değerle gönderildiğinde ilgili cache girdisi silinip görsel yeniden
            işlenir. Yanlış/eksik token varsa istek normal şekilde cache'ten (HIT ise) servis edilir.
        </p>
        <PurgeButton :path="formatExamplePath" />

        <h2>9. modifiers prop (Module Modifier Priority)</h2>
        <NuxtImg src="/tiger.jpg" :modifiers="{ priority: true }" width="200"
            alt="tiger image with raw modifiers" />

        <hr>
    </div>
</template>

<script setup lang="ts">
const cacheBuster = ref(0)
const image = useImage()

// Bu URL'ler fiziksel dosya yolları değildir. @nuxt/image'ın IPX provider'ı
// modifier'ları encode ederek `baseURL/modifiers/source` biçiminde HTTP endpoint'leri üretir.
// Elle yazmak yerine NuxtImg ile aynı modifier sırasını kullanarak provider'a ürettiriyoruz.
const formatExamplePath = image('/tiger.jpg', {
    width: 300,
    height: 300,
    format: 'avif',
    quality: 80,
    fit: 'cover',
})

const presetExamplePath = image('/tiger.jpg', {}, { preset: 'thumbnail' })

const autoFormatExamplePath = image('/tiger.jpg', {
    width: 200,
    format: 'auto',
})
</script>