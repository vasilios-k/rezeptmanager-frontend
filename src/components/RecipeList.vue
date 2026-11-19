<script setup lang="ts">
import RecipeCard from '@/components/RecipeCard.vue'
import type { Recipe } from '@/types/recipe'

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
    <p class="recipe-count" role="status" aria-atomic="true">
      {{ recipes.length }}
      {{ recipes.length === 1 ? 'Rezept' : 'Rezepte' }}
    </p>

    <ul v-if="recipes.length > 0" class="recipe-grid">
      <li v-for="recipe in recipes" :key="recipe.id">
        <RecipeCard
          :recipe="recipe"
          :actions-disabled="actionsDisabled"
          @edit="emit('edit', $event)"
          @delete="emit('delete', $event)"
        />
      </li>
    </ul>

    <p v-else class="empty-state">
      <slot name="empty">Es sind noch keine Rezepte vorhanden.</slot>
    </p>
  </section>
</template>
