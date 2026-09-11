<template>
  <div>
    <button @click="purge">
      Purge et (doğru token)
    </button>
    <span v-if="status">sonuç: <strong>{{ status }}</strong></span>
  </div>
</template>

<script setup>
const props = defineProps({
  path: { type: String, required: true },
})

const status = ref('')

async function purge() {
  const res = await $fetch.raw(props.path, {
    headers: { 'x-ipx-purge-token': 'playground-secret' },
  })
  status.value = `purge isteği tamamlandı, cache-status: ${res.headers.get('cache-status') || '(boş, yeniden işlendi)'}`
}
</script>
