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
        <RouterLink to="/" class="navigation-link">Meine Rezepte</RouterLink>
        <RouterLink to="/shopping-list" class="navigation-link">Einkaufsliste</RouterLink>
      </nav>
    </div>
  </header>

  <main class="container app-main">
    <RouterView />
  </main>
</template>

<style scoped>
.app-header-inner {
  flex-wrap: wrap;
  gap: 12px 24px;
  padding-block: 16px;
}

nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
}

.navigation-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}

.navigation-link.router-link-exact-active {
  text-decoration: underline;
  text-underline-offset: 5px;
}
</style>
