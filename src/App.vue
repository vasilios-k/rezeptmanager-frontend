<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header class="app-header">
    <div class="container app-header-inner">
      <RouterLink to="/" class="brand">
        <span class="brand-mark" aria-hidden="true">R</span>
        <span>Rezeptmanager</span>
      </RouterLink>

      <nav aria-label="Hauptnavigation">
        <RouterLink to="/" class="navigation-link"> Meine Rezepte </RouterLink>
      </nav>
    </div>
  </header>

  <main class="container app-main">
    <RouterView />
  </main>
</template>
