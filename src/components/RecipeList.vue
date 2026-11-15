<script setup lang="ts">
import type { Recipe } from '@/types/recipe'
import { formatIngredientAmount } from '@/utils/formatIngredient'

withDefaults(
  defineProps<{
    recipes: Recipe[]
    actionsDisabled?: boolean
  }>(),
  {
    actionsDisabled: false,
  },
)

const emit = defineEmits<{
  edit: [recipe: Recipe]
}>()
</script>

<template>
  <section aria-label="Rezeptübersicht">
    <p class="recipe-count">
      {{ recipes.length }}
      {{ recipes.length === 1 ? 'Rezept' : 'Rezepte' }}
    </p>

    <ul v-if="recipes.length > 0" class="recipe-grid">
      <li v-for="recipe in recipes" :key="recipe.id">
        <article class="recipe-card">
          <header>
            <h2>{{ recipe.title }}</h2>

            <p class="recipe-meta">
              <span>{{ recipe.prepTimeMinutes }} Min.</span>
              <span>
                {{ recipe.servings }}
                {{ recipe.servings === 1 ? 'Portion' : 'Portionen' }}
              </span>
            </p>
          </header>

          <h3>Zutaten</h3>

          <ul class="ingredient-list">
            <li v-for="item in recipe.ingredients" :key="item.ingredient.id">
              <span>{{ item.ingredient.name }}</span>
              <span class="ingredient-amount">
                {{ formatIngredientAmount(item) }}
              </span>
            </li>
          </ul>

          <details class="instructions">
            <summary>Zubereitung</summary>
            <p>{{ recipe.instructions }}</p>
          </details>

          <footer class="recipe-actions">
            <button
              type="button"
              class="edit-button"
              :disabled="actionsDisabled"
              :aria-label="`Rezept ${recipe.title} bearbeiten`"
              @click="emit('edit', recipe)"
            >
              Bearbeiten
            </button>
          </footer>
        </article>
      </li>
    </ul>

    <p v-else class="empty-state">Es sind noch keine Rezepte vorhanden.</p>
  </section>
</template>

<style scoped>
.recipe-actions {
  margin-top: 20px;
}

.edit-button {
  padding: 10px 16px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  color: var(--color-primary);
  background-color: #ffffff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.edit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edit-button:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}
</style>
