<script setup lang="ts">
import RecipeList from '@/components/RecipeList.vue'
import { exampleRecipes } from '@/data/exampleRecipes'
</script>

<template>
  <section class="page-intro">
    <p class="eyebrow">Deine Rezeptsammlung</p>
    <h1>Meine Rezepte</h1>
    <p class="page-description">Zutaten, Mengen und Zubereitung im Überblick.</p>
  </section>

  <RecipeList :recipes="exampleRecipes" />
</template>
