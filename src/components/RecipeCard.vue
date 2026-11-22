<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import RecipePortions from '@/components/RecipePortions.vue'
import type { Recipe } from '@/types/recipe'
import { formatIngredientAmount } from '@/utils/formatIngredient'
import { scaleRecipeIngredients } from '@/utils/scaleRecipe'

const props = withDefaults(
  defineProps<{
    recipe: Recipe
    actionsDisabled?: boolean
  }>(),
  { actionsDisabled: false },
)

const emit = defineEmits<{
  edit: [recipe: Recipe]
  delete: [recipe: Recipe]
}>()

const selectedServings = ref(props.recipe.servings)

const displayedIngredients = computed(() =>
  scaleRecipeIngredients(props.recipe, selectedServings.value),
)

watch(
  () => props.recipe,
  (recipe) => {
    selectedServings.value = recipe.servings
  },
)
</script>

<template>
  <article class="recipe-card" :aria-labelledby="`recipe-heading-${recipe.id}`">
    <header>
      <h2 :id="`recipe-heading-${recipe.id}`">
        <RouterLink
          v-if="!actionsDisabled"
          class="recipe-title-link"
          :to="{
            name: 'recipe-detail',
            params: { id: String(recipe.id) },
            query:
              selectedServings === recipe.servings ? {} : { servings: String(selectedServings) },
          }"
        >
          {{ recipe.title }}
        </RouterLink>

        <span v-else>{{ recipe.title }}</span>
      </h2>

      <div class="recipe-meta">
        <span>{{ recipe.prepTimeMinutes }} Min.</span>

        <RecipePortions
          v-model="selectedServings"
          :recipe="recipe"
          :actions-disabled="actionsDisabled"
        />
      </div>
    </header>

    <h3>Zutaten</h3>

    <ul class="ingredient-list">
      <li v-for="item in displayedIngredients" :key="item.ingredient.id">
        <span>{{ item.ingredient.name }}</span>
        <span class="ingredient-amount">{{ formatIngredientAmount(item) }}</span>
      </li>
    </ul>

    <details class="instructions">
      <summary>Zubereitung</summary>
      <p>{{ recipe.instructions }}</p>
    </details>

    <footer class="recipe-actions">
      <button
        type="button"
        class="recipe-action-button edit-button"
        :disabled="actionsDisabled"
        :aria-label="`Rezept ${recipe.title} bearbeiten`"
        @click="emit('edit', recipe)"
      >
        Bearbeiten
      </button>

      <button
        type="button"
        class="recipe-action-button delete-button"
        :disabled="actionsDisabled"
        :aria-label="`Rezept ${recipe.title} löschen`"
        @click="emit('delete', recipe)"
      >
        Löschen
      </button>
    </footer>
  </article>
</template>

<style scoped>
.recipe-card {
  min-width: 0;
}

.recipe-card h2,
.ingredient-list li > span:first-child {
  overflow-wrap: anywhere;
}

.ingredient-list li > span:first-child {
  min-width: 0;
}

.recipe-title-link:hover {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 4px;
}

.recipe-meta {
  align-items: center;
}

.recipe-meta > span {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}

.recipe-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}

.recipe-action-button {
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

.delete-button {
  border-color: #a52f2f;
  color: #a52f2f;
}

.recipe-action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.recipe-action-button:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}
</style>
