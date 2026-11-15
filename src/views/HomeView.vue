<script setup lang="ts">
import { onMounted, ref } from 'vue'
import RecipeForm from '@/components/RecipeForm.vue'
import RecipeList from '@/components/RecipeList.vue'
import { getRecipes } from '@/services/recipeService'
import type { Recipe } from '@/types/recipe'

const recipes = ref<Recipe[]>([])
const isLoading = ref(true)
const errorMessage = ref('')
const isFormOpen = ref(false)
const editingRecipe = ref<Recipe | null>(null)
const successMessage = ref('')

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

function openCreateForm(): void {
  successMessage.value = ''
  editingRecipe.value = null
  isFormOpen.value = true
}

function openEditForm(recipe: Recipe): void {
  successMessage.value = ''
  editingRecipe.value = recipe
  isFormOpen.value = true
}

function closeForm(): void {
  isFormOpen.value = false
  editingRecipe.value = null
}

async function handleSaved(recipe: Recipe): Promise<void> {
  const wasEditing = editingRecipe.value !== null

  closeForm()

  successMessage.value = wasEditing
    ? `„${recipe.title}“ wurde aktualisiert.`
    : `„${recipe.title}“ wurde gespeichert.`

  await loadRecipes()
}

onMounted(loadRecipes)
</script>

<template>
  <section class="page-intro">
    <p class="eyebrow">Deine Rezeptsammlung</p>

    <div class="page-heading">
      <div>
        <h1>Meine Rezepte</h1>
        <p class="page-description">Zutaten, Mengen und Zubereitung im Überblick.</p>
      </div>

      <button
        v-if="!isFormOpen"
        type="button"
        class="action-button"
        :disabled="isLoading"
        @click="openCreateForm"
      >
        Rezept anlegen
      </button>
    </div>
  </section>

  <p v-if="successMessage" class="success-message" role="status">
    {{ successMessage }}
  </p>

  <RecipeForm
    v-if="isFormOpen"
    :key="editingRecipe?.id ?? 'new'"
    :recipe="editingRecipe"
    @saved="handleSaved"
    @cancel="closeForm"
  />

  <p v-if="isLoading" class="empty-state" role="status">Rezepte werden geladen …</p>

  <div v-else-if="errorMessage" class="empty-state" role="alert">
    <p class="error-message">{{ errorMessage }}</p>
    <button
      type="button"
      class="action-button retry-button"
      :disabled="isFormOpen"
      @click="loadRecipes"
    >
      Erneut versuchen
    </button>
  </div>

  <RecipeList v-else :recipes="recipes" :actions-disabled="isFormOpen" @edit="openEditForm" />
</template>

<style scoped>
.page-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
}

.action-button {
  padding: 12px 18px;
  border: 0;
  border-radius: 8px;
  color: #ffffff;
  background-color: var(--color-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-button:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

.success-message {
  margin: 0 0 24px;
  padding: 16px 20px;
  border: 1px solid #bfd6bc;
  border-radius: 10px;
  color: var(--color-primary);
  background-color: #eaf3e9;
}

.error-message {
  margin: 0;
}

.retry-button {
  margin-top: 16px;
}
</style>
