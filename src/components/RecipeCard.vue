<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { Recipe } from '@/types/recipe'
import { formatIngredientAmount } from '@/utils/formatIngredient'
import { isValidServings, MAX_SERVINGS, scaleRecipeIngredients } from '@/utils/scaleRecipe'

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
const servingsInput = ref<number | ''>(props.recipe.servings)
const isEditingServings = ref(false)

const servingsTrigger = ref<HTMLButtonElement | null>(null)
const servingsEditor = ref<HTMLDivElement | null>(null)
const servingsInputElement = ref<HTMLInputElement | null>(null)

let servingsBeforeEditing = props.recipe.servings

const hasValidServings = computed(
  () => isValidServings(servingsInput.value) && servingsInput.value >= props.recipe.servings,
)

const displayedIngredients = computed(() =>
  scaleRecipeIngredients(props.recipe, selectedServings.value),
)

watch(servingsInput, (value) => {
  if (isEditingServings.value && isValidServings(value) && value >= props.recipe.servings) {
    selectedServings.value = value
  }
})

watch(
  () => props.recipe,
  (recipe) => {
    isEditingServings.value = false
    selectedServings.value = recipe.servings
    servingsInput.value = recipe.servings
    servingsBeforeEditing = recipe.servings
  },
)

watch(isEditingServings, (isEditing) => {
  if (isEditing) {
    document.addEventListener('pointerdown', handleOutsidePointer)
  } else {
    document.removeEventListener('pointerdown', handleOutsidePointer)
  }
})

watch(
  () => props.actionsDisabled,
  (disabled) => {
    if (disabled && isEditingServings.value) {
      void finishServings()
    }
  },
)

async function openServings(): Promise<void> {
  if (props.actionsDisabled) return

  servingsBeforeEditing = selectedServings.value
  servingsInput.value = selectedServings.value
  isEditingServings.value = true

  await nextTick()

  servingsInputElement.value?.focus({ preventScroll: true })
  servingsInputElement.value?.select()
}

function changeServings(change: number): void {
  servingsInput.value = Math.min(
    MAX_SERVINGS,
    Math.max(props.recipe.servings, selectedServings.value + change),
  )
}

async function resetServings(): Promise<void> {
  servingsInput.value = props.recipe.servings

  await nextTick()

  servingsInputElement.value?.focus({ preventScroll: true })
}

async function finishServings(restoreFocus = false): Promise<void> {
  const value = servingsInput.value

  if (typeof value === 'number' && Number.isInteger(value)) {
    selectedServings.value = Math.min(MAX_SERVINGS, Math.max(props.recipe.servings, value))
  }

  servingsInput.value = selectedServings.value
  isEditingServings.value = false

  if (restoreFocus) {
    await nextTick()
    servingsTrigger.value?.focus({ preventScroll: true })
  }
}

async function cancelServings(): Promise<void> {
  selectedServings.value = servingsBeforeEditing
  servingsInput.value = servingsBeforeEditing
  isEditingServings.value = false

  await nextTick()

  servingsTrigger.value?.focus({ preventScroll: true })
}

function handleEditorFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget

  if (nextTarget instanceof Node && !servingsEditor.value?.contains(nextTarget)) {
    void finishServings()
  }
}

function handleOutsidePointer(event: PointerEvent): void {
  if (event.target instanceof Node && !servingsEditor.value?.contains(event.target)) {
    void finishServings()
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointer)
})
</script>

<template>
  <article class="recipe-card" :aria-labelledby="`recipe-heading-${recipe.id}`">
    <header>
      <h2 :id="`recipe-heading-${recipe.id}`">{{ recipe.title }}</h2>

      <div class="recipe-meta">
        <span>{{ recipe.prepTimeMinutes }} Min.</span>

        <button
          v-if="!isEditingServings"
          ref="servingsTrigger"
          type="button"
          class="servings-trigger"
          :disabled="actionsDisabled"
          :aria-label="`${selectedServings} ${selectedServings === 1 ? 'Portion' : 'Portionen'} für ${recipe.title} ändern`"
          @click="openServings"
        >
          {{ selectedServings }} {{ selectedServings === 1 ? 'Portion' : 'Portionen' }}
        </button>

        <div
          v-else
          ref="servingsEditor"
          class="servings-editor"
          role="group"
          :aria-label="`Portionen für ${recipe.title}`"
          @focusout="handleEditorFocusOut"
          @keydown.esc.prevent="cancelServings"
        >
          <button
            type="button"
            class="portion-button decrease-servings"
            :disabled="actionsDisabled || selectedServings <= recipe.servings"
            :aria-label="`Portionen für ${recipe.title} verringern`"
            @click="changeServings(-1)"
          >
            ‹
          </button>

          <input
            ref="servingsInputElement"
            v-model.number="servingsInput"
            class="servings-input"
            type="number"
            :min="recipe.servings"
            :max="MAX_SERVINGS"
            step="1"
            inputmode="numeric"
            required
            :disabled="actionsDisabled"
            :aria-label="`Portionen für ${recipe.title}, mindestens ${recipe.servings}`"
            :aria-invalid="!hasValidServings"
            :aria-describedby="!hasValidServings ? `servings-error-${recipe.id}` : undefined"
            @keydown.enter.prevent="finishServings(true)"
          />

          <button
            type="button"
            class="portion-button increase-servings"
            :disabled="actionsDisabled || selectedServings >= MAX_SERVINGS"
            :aria-label="`Portionen für ${recipe.title} erhöhen`"
            @click="changeServings(1)"
          >
            ›
          </button>

          <button
            type="button"
            class="portion-button reset-servings"
            :disabled="
              actionsDisabled || (hasValidServings && selectedServings === recipe.servings)
            "
            :aria-label="`Portionen für ${recipe.title} auf ${recipe.servings} zurücksetzen`"
            title="Auf Originalportionen zurücksetzen"
            @click="resetServings"
          >
            ↺
          </button>
        </div>
      </div>

      <p
        v-if="isEditingServings && !hasValidServings"
        :id="`servings-error-${recipe.id}`"
        class="servings-error"
        role="alert"
      >
        Bitte eine ganze Portionszahl ab {{ recipe.servings }} eingeben.
      </p>

      <p class="visually-hidden" role="status" aria-atomic="true">
        Zutatenmengen für {{ selectedServings }}
        {{ selectedServings === 1 ? 'Portion' : 'Portionen' }}.
      </p>
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

.recipe-meta {
  align-items: center;
}

.recipe-meta > span {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}

.servings-trigger {
  min-height: 44px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--color-primary);
  background-color: #f1f4ee;
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.servings-trigger:hover:not(:disabled) {
  border-color: var(--color-primary);
  background-color: #e6ede2;
}

.servings-editor {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: #ffffff;
}

.portion-button,
.servings-input {
  min-height: 44px;
  padding: 0;
  border: none;
  color: var(--color-primary);
  background-color: #ffffff;
  font: inherit;
  text-align: center;
}

.portion-button {
  width: 44px;
  font-size: 1.5rem;
  cursor: pointer;
}

.portion-button:hover:not(:disabled) {
  background-color: #f1f4ee;
}

.servings-input {
  width: 60px;
  min-width: 0;
  padding: 8px 4px;
  border-inline: 1px solid var(--color-border);
  font-variant-numeric: tabular-nums;
  appearance: textfield;
  -moz-appearance: textfield;
}

.servings-input::-webkit-inner-spin-button,
.servings-input::-webkit-outer-spin-button {
  margin: 0;
  -webkit-appearance: none;
}

.reset-servings {
  border-left: 1px solid var(--color-border);
  font-size: 1.2rem;
}

.servings-error {
  margin: 8px 0 0;
  color: #a52f2f;
  font-size: 0.85rem;
  line-height: 1.5;
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

button:disabled,
.servings-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:focus-visible,
.servings-input:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

.portion-button:focus-visible,
.servings-input:focus-visible {
  outline-offset: -3px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
</style>
