<script setup lang="ts">
import { onMounted, ref } from 'vue'
import RecipeList from '@/components/RecipeList.vue'
import { getRecipes } from '@/services/recipeService'
import type { Recipe } from '@/types/recipe'

const recipes = ref<Recipe[]>([])
const isLoading = ref(true)
const errorMessage = ref('')

async function loadRecipes(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    recipes.value = await getRecipes()
  } catch (error) {
    console.error('Rezepte konnten nicht geladen werden:', error)
    errorMessage.value = 'Die Rezepte konnten nicht geladen werden. Bitte versuche es erneut.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadRecipes)
</script>

<template>
  <section class="page-intro">
    <p class="eyebrow">Deine Rezeptsammlung</p>
    <h1>Meine Rezepte</h1>
    <p class="page-description">Zutaten, Mengen und Zubereitung im Überblick.</p>
  </section>

  <p v-if="isLoading" class="empty-state" role="status">Rezepte werden geladen …</p>

  <div v-else-if="errorMessage" class="empty-state" role="alert">
    <p class="error-message">{{ errorMessage }}</p>
    <button type="button" class="retry-button" @click="loadRecipes">Erneut versuchen</button>
  </div>

  <RecipeList v-else :recipes="recipes" />
</template>

<style scoped>
.error-message {
  margin: 0;
}

.retry-button {
  margin-top: 16px;
  padding: 10px 16px;
  border: 0;
  border-radius: 8px;
  background-color: var(--color-primary);
  color: #ffffff;
  font: inherit;
  cursor: pointer;
}

.retry-button:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}
</style>
