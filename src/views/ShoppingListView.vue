<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import RecipePortions from '@/components/RecipePortions.vue'
import RecipeCosts from '@/components/RecipeCosts.vue'
import { getRecipes } from '@/services/recipeService'
import {
  pruneShoppingChecks,
  removeShoppingRecipe,
  setShoppingItemChecked,
  setShoppingRecipe,
  shoppingListState,
  syncShoppingRecipes,
} from '@/stores/shoppingList'
import type { Recipe } from '@/types/recipe'
import { buildShoppingList } from '@/utils/buildShoppingList'
import { formatIngredientAmount } from '@/utils/formatIngredient'

const recipes = ref<Recipe[]>([])
const isLoading = ref(true)
const errorMessage = ref('')
const removedCount = ref(0)

let isActive = true

const selectionsById = computed(
  () => new Map(shoppingListState.selections.map((item) => [item.recipeId, item.servings])),
)

const items = computed(() => buildShoppingList(recipes.value, shoppingListState.selections))

const checkedCount = computed(
  () => items.value.filter((item) => shoppingListState.checkedKeys.includes(item.signature)).length,
)

async function loadRecipes(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const selectedBeforeRequest = new Set(
        shoppingListState.selections.map((item) => item.recipeId),
      )
      const loadedRecipes = await getRecipes()

      if (!isActive) return

      // Eine während des Abrufs synchronisierte neue Auswahl darf nicht als gelöscht gelten.
      const newMissingSelection = shoppingListState.selections.some(
        (item) =>
          !selectedBeforeRequest.has(item.recipeId) &&
          !loadedRecipes.some((recipe) => recipe.id === item.recipeId),
      )
      if (newMissingSelection) continue

      removedCount.value = syncShoppingRecipes(loadedRecipes)
      recipes.value = loadedRecipes
      return
    }
    throw new Error('Die Rezeptauswahl wurde während des Ladens geändert.')
  } catch (error) {
    if (!isActive) return

    console.error('Rezepte für die Einkaufsliste konnten nicht geladen werden:', error)

    errorMessage.value = 'Die Rezepte konnten nicht geladen werden. Deine Auswahl bleibt erhalten.'
  } finally {
    isLoading.value = false
  }
}

function selectRecipe(recipe: Recipe, event: Event): void {
  if ((event.target as HTMLInputElement).checked) {
    setShoppingRecipe(recipe, recipe.servings)
  } else {
    removeShoppingRecipe(recipe.id)
  }
}

function updateServings(recipe: Recipe, servings: number): void {
  if (selectionsById.value.has(recipe.id)) {
    setShoppingRecipe(recipe, servings)
  }
}

function checkItem(signature: string, event: Event): void {
  setShoppingItemChecked(signature, (event.target as HTMLInputElement).checked)
}

watch(
  () => shoppingListState.selections.map((item) => item.recipeId).join(','),
  () => {
    if (
      !isLoading.value &&
      shoppingListState.selections.some(
        (item) => !recipes.value.some((recipe) => recipe.id === item.recipeId),
      )
    ) {
      void loadRecipes()
    }
  },
  { flush: 'sync' },
)

watch([items, isLoading], () => {
  if (
    !isLoading.value &&
    !errorMessage.value &&
    shoppingListState.selections.every((item) =>
      recipes.value.some((recipe) => recipe.id === item.recipeId),
    )
  ) {
    pruneShoppingChecks(items.value.map((item) => item.signature))
  }
})

function refreshWhenVisible(): void {
  if (document.visibilityState === 'visible' && !isLoading.value) void loadRecipes()
}

onMounted(() => {
  void loadRecipes()
  window.addEventListener('focus', refreshWhenVisible)
  document.addEventListener('visibilitychange', refreshWhenVisible)
})

onBeforeUnmount(() => {
  isActive = false
  window.removeEventListener('focus', refreshWhenVisible)
  document.removeEventListener('visibilitychange', refreshWhenVisible)
})
</script>

<template>
  <header class="page-intro">
    <p class="eyebrow">Für deinen Einkauf</p>
    <h1>Einkaufsliste</h1>

    <p class="page-description">
      Wähle Rezepte aus und passe ihre Portionen an. Wir fassen die Zutaten für dich zusammen.
    </p>
  </header>

  <p v-if="isLoading" class="empty-state" role="status">Rezepte werden geladen …</p>

  <div v-else-if="errorMessage" class="empty-state" role="alert">
    <p>{{ errorMessage }}</p>

    <button type="button" class="retry-button" @click="loadRecipes">Erneut versuchen</button>
  </div>

  <template v-else>
    <p v-if="removedCount" class="shopping-notice" role="status">
      {{ removedCount }}
      {{ removedCount === 1 ? 'gelöschtes Rezept wurde' : 'gelöschte Rezepte wurden' }}
      aus deiner Auswahl entfernt.
    </p>

    <div class="shopping-layout">
      <section class="shopping-panel" aria-labelledby="selection-heading">
        <h2 id="selection-heading">Rezepte auswählen</h2>

        <p class="panel-description" role="status">
          {{ shoppingListState.selections.length }}
          {{
            shoppingListState.selections.length === 1 ? 'Rezept ausgewählt' : 'Rezepte ausgewählt'
          }}
        </p>

        <p v-if="recipes.length === 0" class="shopping-empty">Lege zuerst ein Rezept an.</p>

        <ul v-else class="recipe-selection-list">
          <li
            v-for="recipe in recipes"
            :key="recipe.id"
            class="recipe-selection"
            :class="{ selected: selectionsById.has(recipe.id) }"
          >
            <label class="recipe-selection-label">
              <input
                class="recipe-selection-input"
                type="checkbox"
                :checked="selectionsById.has(recipe.id)"
                :value="recipe.id"
                @change="selectRecipe(recipe, $event)"
              />

              <span>{{ recipe.title }}</span>
            </label>

            <RecipePortions
              :recipe="recipe"
              :model-value="selectionsById.get(recipe.id) ?? recipe.servings"
              :actions-disabled="!selectionsById.has(recipe.id)"
              @update:model-value="updateServings(recipe, $event)"
            />
          </li>
        </ul>
      </section>

      <section class="shopping-panel" aria-labelledby="shopping-items-heading">
        <h2 id="shopping-items-heading">Das brauchst du</h2>

        <p v-if="items.length" class="panel-description" role="status" aria-atomic="true">
          {{ checkedCount }} von {{ items.length }} Zutaten eingekauft
        </p>

        <p v-else class="shopping-empty">Wähle mindestens ein Rezept aus.</p>

        <ul v-if="items.length" class="shopping-items">
          <li
            v-for="item in items"
            :key="item.key"
            :class="{
              checked: shoppingListState.checkedKeys.includes(item.signature),
            }"
          >
            <label class="shopping-item-label">
              <input
                class="shopping-item-checkbox"
                type="checkbox"
                :checked="shoppingListState.checkedKeys.includes(item.signature)"
                @change="checkItem(item.signature, $event)"
              />

              <span class="shopping-item-name">
                {{ item.ingredient.name }}
              </span>

              <span class="shopping-item-amount">
                {{ formatIngredientAmount(item) }}
              </span>
            </label>
          </li>
        </ul>

        <p class="shopping-hint">
          g und kg sowie ml und l werden zusammengerechnet. Andere Einheiten bleiben getrennt.
          Änderungen an der Rezeptauswahl oder den Portionen setzen die Häkchen zurück.
        </p>
      </section>
    </div>

    <RecipeCosts :ingredients="items" shopping />

    <p class="storage-hint">
      Deine Auswahl und Häkchen werden mit deinem Konto auf anderen Geräten synchronisiert.
    </p>
  </template>
</template>

<style scoped>
.shopping-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 24px;
}

.shopping-panel {
  min-width: 0;
  padding: 28px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: #fff;
}

.shopping-panel h2 {
  margin: 0;
  font:
    1.6rem Georgia,
    serif;
}

.panel-description,
.shopping-empty,
.shopping-hint,
.storage-hint {
  color: var(--color-muted);
  line-height: 1.6;
}

.panel-description {
  margin: 12px 0 20px;
}

.recipe-selection-list,
.shopping-items {
  padding: 0;
  margin: 0;
  list-style: none;
}

.recipe-selection {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.recipe-selection + .recipe-selection {
  margin-top: 12px;
}

.recipe-selection.selected {
  background: #f5f8f3;
  border-color: #8ca594;
}

.recipe-selection-label,
.shopping-item-label {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  cursor: pointer;
  overflow-wrap: anywhere;
}

.recipe-selection-label {
  font-weight: 600;
}

.recipe-selection :deep(.recipe-portions) {
  margin-left: 32px;
}

input[type='checkbox'] {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin: 0;
  accent-color: var(--color-primary);
}

input:focus-visible,
.retry-button:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 4px;
}

.shopping-items li + li {
  border-top: 1px solid var(--color-border);
}

.shopping-item-label {
  padding-block: 12px;
}

.shopping-item-name {
  flex: 1;
  min-width: 0;
}

.shopping-item-amount {
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

.checked .shopping-item-name,
.checked .shopping-item-amount {
  text-decoration: line-through;
  color: var(--color-muted);
}

.shopping-hint,
.storage-hint,
.shopping-notice {
  font-size: 0.85rem;
}

.shopping-hint {
  margin: 24px 0 0;
}

.storage-hint {
  margin: 20px 0 0;
}

.shopping-notice {
  padding: 14px 18px;
  border-radius: 12px;
  background: #e9f1e6;
  line-height: 1.6;
}

.retry-button {
  min-height: 44px;
  padding: 10px 16px;
  border: 0;
  border-radius: 8px;
  background: var(--color-primary);
  color: white;
  font: inherit;
  cursor: pointer;
}

@media (max-width: 800px) {
  .shopping-layout {
    grid-template-columns: 1fr;
  }

  .shopping-panel {
    padding: 22px;
  }
}

@media (max-width: 400px) {
  .recipe-selection :deep(.recipe-portions) {
    margin-left: 0;
  }
}
</style>
