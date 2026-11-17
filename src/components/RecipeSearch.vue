<script setup lang="ts">
import { ref } from 'vue'

const query = defineModel<string>({
  required: true,
})

withDefaults(
  defineProps<{
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const searchInput = ref<HTMLInputElement | null>(null)

function resetSearch(): void {
  query.value = ''
  searchInput.value?.focus({ preventScroll: true })
}
</script>

<template>
  <form class="recipe-search" role="search" aria-label="Rezeptsuche" @submit.prevent>
    <label for="recipe-search">Rezepte suchen</label>

    <div class="search-controls">
      <input
        id="recipe-search"
        ref="searchInput"
        v-model="query"
        type="search"
        maxlength="200"
        placeholder="Rezeptname oder Zutat"
        aria-describedby="recipe-search-hint"
        :disabled="disabled"
      />

      <button
        type="button"
        class="reset-search-button"
        aria-label="Suche zurücksetzen"
        :disabled="disabled || query.length === 0"
        @click="resetSearch"
      >
        Zurücksetzen
      </button>
    </div>

    <p id="recipe-search-hint">
      Durchsucht Rezeptnamen und Zutaten, unabhängig von Groß- und Kleinschreibung.
    </p>
  </form>
</template>

<style scoped>
.recipe-search {
  margin-bottom: 24px;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background-color: #ffffff;
}

label {
  display: block;
  margin-bottom: 12px;
  font-weight: 700;
}

.search-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
}

input,
button {
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font: inherit;
}

input {
  width: 100%;
  min-width: 0;
  color: inherit;
  background-color: #ffffff;
}

input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

button {
  color: var(--color-primary);
  background-color: #f1f4ee;
  font-weight: 600;
  cursor: pointer;
}

input:disabled,
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

input:focus-visible,
button:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

p {
  margin: 12px 0 0;
  color: var(--color-muted);
  font-size: 0.85rem;
  line-height: 1.6;
}

@media (max-width: 600px) {
  .search-controls {
    grid-template-columns: 1fr;
  }
}
</style>
