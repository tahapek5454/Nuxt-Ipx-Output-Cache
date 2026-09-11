<template>
  <div>
    <h1>Nuxt ipx output cache playground</h1>

    <h2>Default img tag</h2>
    <img src="/tiger.jpg"
     width="300" 
     height="300" 
     alt="tiger image default img tag">

    <br>

    <h2>NuxtImg component</h2>
    <NuxtImg src="/tiger.jpg"
     format="avif"
     width="300" 
     height="300" 
     sizes="100px sm:200px md:300px" 
     fit="cover"
     :quality="80"
     alt="tiger image"></NuxtImg>
  </div>
</template>

<script setup>
</script>
