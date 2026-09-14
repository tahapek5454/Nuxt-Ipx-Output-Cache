<template>
    <div>
        <h1>Nuxt ipx output cache playground</h1>
        
        <h2>1. modifiers prop (Module Modifier Priority) Used</h2>
        <NuxtImg key="1" src="/tiger.jpg" format="webp" :modifiers="{ priority: true }"  width="200"
            alt="tiger image with raw modifiers" />

        <h2>2. modifiers prop (Module Modifier Priority) Not Used</h2>
        <NuxtImg key="2" src="/tiger.jpg" format="webp" :modifiers="{ priority: false }"  width="200"
            alt="tiger image with raw modifiers" />

        <h2>3. modifiers prop (Module Modifier Priority) No Definition Not Used</h2>
        <NuxtImg key="4" src="/tiger.jpg" format="webp" width="200"
            alt="tiger image with raw modifiers" />

        <hr>
    </div>
</template>

