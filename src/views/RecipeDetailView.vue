<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import RecipePortions from '@/components/RecipePortions.vue'
import { getRecipe } from '@/services/recipeService'
import type { Recipe } from '@/types/recipe'
import { formatIngredientAmount } from '@/utils/formatIngredient'
import { isValidServings, scaleRecipeIngredients } from '@/utils/scaleRecipe'

const props = defineProps<{ id: string }>()
const route = useRoute()
const router = useRouter()

const recipe = ref<Recipe | null>(null)
const isLoading = ref(true)
const errorMessage = ref('')
const selectedServings = ref(1)
const checkedIngredients = ref<number[]>([])
const pageHeading = ref<HTMLHeadingElement | null>(null)

let activeRequest: AbortController | null = null

const displayedIngredients = computed(() =>
  recipe.value ? scaleRecipeIngredients(recipe.value, selectedServings.value) : [],
)

const instructionSteps = computed(() =>
  (recipe.value?.instructions ?? '')
    .split(/\r\n|\r|\n/)
    .map((step) => step.trim())
    .filter((step) => step.length > 0),
)

function readServings(originalServings: number): number {
  const value = typeof route.query.servings === 'string' ? Number(route.query.servings) : undefined

  return isValidServings(value) && value >= originalServings ? value : originalServings
}

function syncServingsQuery(): void {
  if (!recipe.value || isLoading.value) return

  const value =
    selectedServings.value === recipe.value.servings ? undefined : String(selectedServings.value)

  if (route.query.servings === value) return

  const query = { ...route.query }

  if (value === undefined) delete query.servings
  else query.servings = value

  void router.replace({ query })
}

async function focusHeading(): Promise<void> {
  await nextTick()
  pageHeading.value?.focus({ preventScroll: true })
}

async function loadRecipe(): Promise<void> {
  activeRequest?.abort()

  const controller = new AbortController()
  activeRequest = controller

  isLoading.value = true
  recipe.value = null
  checkedIngredients.value = []
  errorMessage.value = ''

  const id = Number(props.id)

  if (!/^[1-9]\d*$/.test(props.id) || !Number.isSafeInteger(id)) {
    isLoading.value = false
    document.title = 'Rezept nicht gefunden | Rezeptmanager'

    await focusHeading()
    return
  }

  try {
    const loadedRecipe = await getRecipe(id, controller.signal)

    if (controller.signal.aborted) return

    if (loadedRecipe) selectedServings.value = readServings(loadedRecipe.servings)

    recipe.value = loadedRecipe
    document.title = loadedRecipe
      ? `${loadedRecipe.title} | Rezeptmanager`
      : 'Rezept nicht gefunden | Rezeptmanager'
  } catch (error) {
    if (controller.signal.aborted) return

    console.error('Rezept konnte nicht geladen werden:', error)
    errorMessage.value = 'Das Rezept konnte nicht geladen werden. Bitte versuche es erneut.'
    document.title = 'Rezept laden | Rezeptmanager'
  } finally {
    if (!controller.signal.aborted) {
      isLoading.value = false
      syncServingsQuery()
      await focusHeading()
    }
  }
}

watch(() => props.id, loadRecipe, { immediate: true })

watch(selectedServings, () => {
  checkedIngredients.value = []
  syncServingsQuery()
})

watch(
  () => route.query.servings,
  () => {
    if (recipe.value && !isLoading.value) {
      selectedServings.value = readServings(recipe.value.servings)
    }
  },
)

onBeforeUnmount(() => activeRequest?.abort())
</script>

<template>
  <RouterLink :to="{ name: 'recipes' }" class="back-link"> ← Zur Rezeptübersicht </RouterLink>

  <p v-if="isLoading" class="empty-state" role="status">Rezept wird geladen …</p>

  <section v-else-if="errorMessage" class="empty-state detail-state" role="alert">
    <h1 ref="pageHeading" tabindex="-1">Rezept konnte nicht geladen werden</h1>
    <p>{{ errorMessage }}</p>

    <button type="button" class="detail-button retry-button" @click="loadRecipe">
      Erneut versuchen
    </button>
  </section>

  <article v-else-if="recipe" class="recipe-detail">
    <header class="detail-header">
      <p class="eyebrow">Dein Rezept</p>
      <h1 ref="pageHeading" tabindex="-1">{{ recipe.title }}</h1>

      <div class="recipe-meta">
        <span>{{ recipe.prepTimeMinutes }} Min.</span>
        <RecipePortions v-model="selectedServings" :recipe="recipe" />
      </div>
    </header>

    <div class="detail-layout">
      <section class="detail-panel" aria-labelledby="ingredients-heading">
        <h2 id="ingredients-heading">Zutaten</h2>

        <p class="checklist-status" role="status" aria-atomic="true">
          {{ checkedIngredients.length }} von {{ recipe.ingredients.length }} Zutaten abgehakt
        </p>

        <ul class="ingredient-list ingredient-checklist">
          <li
            v-for="item in displayedIngredients"
            :key="item.ingredient.id"
            :class="{ checked: checkedIngredients.includes(item.ingredient.id) }"
          >
            <label>
              <input v-model="checkedIngredients" type="checkbox" :value="item.ingredient.id" />
              <span class="ingredient-name">{{ item.ingredient.name }}</span>
              <span class="ingredient-amount">{{ formatIngredientAmount(item) }}</span>
            </label>
          </li>
        </ul>

        <p class="checklist-hint">
          Bei einer Änderung der Portionen werden die Häkchen zurückgesetzt.
        </p>
      </section>

      <section class="detail-panel" aria-labelledby="instructions-heading">
        <h2 id="instructions-heading">Zubereitung</h2>

        <ol class="instruction-steps">
          <li v-for="(step, index) in instructionSteps" :key="index">
            {{ step }}
          </li>
        </ol>
      </section>
    </div>
  </article>

  <section v-else class="empty-state detail-state">
    <h1 ref="pageHeading" tabindex="-1">Rezept nicht gefunden</h1>
    <p>Unter dieser Adresse ist kein Rezept vorhanden.</p>
  </section>
</template>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-bottom: 24px;
  color: var(--color-primary);
  font-weight: 600;
}

.back-link:hover {
  text-decoration: underline;
}

.detail-header {
  margin-bottom: 32px;
}

.detail-header h1 {
  overflow-wrap: anywhere;
}

.recipe-meta {
  align-items: center;
}

.recipe-meta > span {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 360px) minmax(0, 1fr);
  align-items: start;
  gap: 24px;
}

.detail-panel {
  min-width: 0;
  padding: 28px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background-color: #ffffff;
}

.detail-panel h2 {
  margin: 0 0 20px;
  font-family: Georgia, serif;
  font-size: 1.6rem;
}

.checklist-status,
.checklist-hint {
  color: var(--color-muted);
  font-size: 0.85rem;
  line-height: 1.6;
}

.checklist-status {
  margin: 0 0 12px;
}

.checklist-hint {
  margin: 12px 0 0;
}

.ingredient-checklist li {
  padding: 0;
}

.ingredient-checklist label {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 48px;
  padding-block: 12px;
  cursor: pointer;
}

.ingredient-checklist input {
  width: 20px;
  height: 20px;
  margin: 0;
  accent-color: var(--color-primary);
}

.ingredient-name {
  overflow-wrap: anywhere;
}

.checked .ingredient-name,
.checked .ingredient-amount {
  color: var(--color-muted);
  text-decoration: line-through;
}

.instruction-steps {
  display: grid;
  gap: 24px;
  margin: 0;
  padding-left: 24px;
  line-height: 1.75;
}

.instruction-steps li {
  padding-left: 8px;
  overflow-wrap: anywhere;
}

.instruction-steps li::marker {
  color: var(--color-primary);
  font-weight: 700;
}

.detail-button {
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  color: var(--color-primary);
  background-color: #ffffff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.detail-button:focus-visible,
.ingredient-checklist input:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

.detail-state h1 {
  font-size: 1.8rem;
}

@media (max-width: 800px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }

  .detail-panel {
    padding: 22px;
  }
}
</style>
