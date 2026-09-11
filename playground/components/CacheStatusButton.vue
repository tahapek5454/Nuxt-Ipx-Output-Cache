<template>
  <div>
    <button type="button" @click="check">
      Cache durumunu kontrol et
    </button>
    <span v-if="status">cache-status: <strong>{{ status }}</strong></span>
    <div>
      GET <code>{{ path }}</code>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  path: string
}>()

const status = ref('')

async function check() {
  const res = await $fetch.raw(props.path)
  status.value = res.headers.get('cache-status') || '(boş — bu bir MISS)'
}
</script>
