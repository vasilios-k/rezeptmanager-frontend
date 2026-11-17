<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import RecipeDeleteConfirmation from '@/components/RecipeDeleteConfirmation.vue'
import RecipeForm from '@/components/RecipeForm.vue'
import RecipeList from '@/components/RecipeList.vue'
import RecipeSearch from '@/components/RecipeSearch.vue'
import { getRecipes } from '@/services/recipeService'
import type { Recipe } from '@/types/recipe'
import { filterRecipes } from '@/utils/filterRecipes'

const recipes = ref<Recipe[]>([])
const searchQuery = ref('')
const isLoading = ref(true)
const errorMessage = ref('')
const isFormOpen = ref(false)
const editingRecipe = ref<Recipe | null>(null)
const recipeToDelete = ref<Recipe | null>(null)
const successMessage = ref('')
const pageHeading = ref<HTMLHeadingElement | null>(null)

let dialogTriggerElement: HTMLElement | null = null

const actionsDisabled = computed(() => isFormOpen.value || recipeToDelete.value !== null)

const filteredRecipes = computed(() => filterRecipes(recipes.value, searchQuery.value))

const hasSearchQuery = computed(() => searchQuery.value.trim().length > 0)

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

async function focusPageHeading(): Promise<void> {
  await nextTick()
  pageHeading.value?.focus()
}

function rememberDialogTrigger(): void {
  const activeElement = document.activeElement

  dialogTriggerElement = activeElement instanceof HTMLElement ? activeElement : null
}

async function restoreDialogTrigger(): Promise<void> {
  const triggerElement = dialogTriggerElement
  dialogTriggerElement = null

  await nextTick()

  if (triggerElement?.isConnected) {
    triggerElement.focus({ preventScroll: true })
  } else {
    pageHeading.value?.focus({ preventScroll: true })
  }
}

function openCreateForm(): void {
  rememberDialogTrigger()
  editingRecipe.value = null
  isFormOpen.value = true
}

function openEditForm(recipe: Recipe): void {
  rememberDialogTrigger()
  editingRecipe.value = recipe
  isFormOpen.value = true
}

function resetForm(): void {
  isFormOpen.value = false
  editingRecipe.value = null
}

async function cancelForm(): Promise<void> {
  resetForm()
  await restoreDialogTrigger()
}

async function handleSaved(recipe: Recipe): Promise<void> {
  const wasEditing = editingRecipe.value !== null

  resetForm()
  dialogTriggerElement = null
  searchQuery.value = ''

  successMessage.value = wasEditing
    ? `„${recipe.title}“ wurde aktualisiert.`
    : `„${recipe.title}“ wurde gespeichert.`

  await loadRecipes()
  await focusPageHeading()
}

function openDeleteConfirmation(recipe: Recipe): void {
  rememberDialogTrigger()
  recipeToDelete.value = recipe
}

async function cancelDelete(): Promise<void> {
  recipeToDelete.value = null
  await restoreDialogTrigger()
}

async function handleDeleted(recipe: Recipe): Promise<void> {
  recipeToDelete.value = null
  dialogTriggerElement = null
  successMessage.value = `„${recipe.title}“ wurde gelöscht.`

  await loadRecipes()
  await focusPageHeading()
}

onMounted(loadRecipes)
</script>

<template>
  <section class="page-intro">
    <p class="eyebrow">Deine Rezeptsammlung</p>

    <div class="page-heading">
      <div>
        <h1 ref="pageHeading" tabindex="-1">Meine Rezepte</h1>
        <p class="page-description">Zutaten, Mengen und Zubereitung im Überblick.</p>
      </div>

      <button
        type="button"
        class="action-button"
        :disabled="isLoading || actionsDisabled"
        @click="openCreateForm"
      >
        Rezept anlegen
      </button>
    </div>
  </section>

  <div role="status" aria-atomic="true">
    <p v-if="successMessage" class="success-message">
      {{ successMessage }}
    </p>
  </div>

  <RecipeForm
    v-if="isFormOpen"
    :key="editingRecipe?.id ?? 'new'"
    :recipe="editingRecipe"
    @saved="handleSaved"
    @cancel="cancelForm"
  />

  <RecipeDeleteConfirmation
    v-if="recipeToDelete"
    :recipe="recipeToDelete"
    @deleted="handleDeleted"
    @cancel="cancelDelete"
  />

  <p v-if="isLoading" class="empty-state" role="status">Rezepte werden geladen …</p>

  <div v-else-if="errorMessage" class="empty-state" role="alert">
    <p class="error-message">{{ errorMessage }}</p>
    <button
      type="button"
      class="action-button retry-button"
      :disabled="actionsDisabled"
      @click="loadRecipes"
    >
      Erneut versuchen
    </button>
  </div>

  <template v-else>
    <RecipeSearch v-if="recipes.length > 0" v-model="searchQuery" :disabled="actionsDisabled" />

    <RecipeList
      :recipes="filteredRecipes"
      :actions-disabled="actionsDisabled"
      @edit="openEditForm"
      @delete="openDeleteConfirmation"
    >
      <template v-if="hasSearchQuery && recipes.length > 0" #empty>
        Keine passenden Rezepte für „{{ searchQuery.trim() }}“ gefunden.
      </template>
    </RecipeList>
  </template>
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
