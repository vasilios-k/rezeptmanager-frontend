<script setup lang="ts">
import type { Recipe } from '@/types/recipe'
import { formatIngredientAmount } from '@/utils/formatIngredient'

defineProps<{
  recipes: Recipe[]
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
        </article>
      </li>
    </ul>

    <p v-else class="empty-state">Es sind noch keine Rezepte vorhanden.</p>
  </section>
</template>
