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
  delete: [recipe: Recipe]
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
      </li>
    </ul>

    <p v-else class="empty-state">Es sind noch keine Rezepte vorhanden.</p>
  </section>
</template>

<style scoped>
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
