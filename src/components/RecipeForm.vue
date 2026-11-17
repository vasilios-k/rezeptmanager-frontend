<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { createRecipe, updateRecipe } from '@/services/recipeService'
import type { Recipe, RecipeIngredient, RecipeRequest, Unit } from '@/types/recipe'
import { unitLabels } from '@/utils/formatIngredient'

interface IngredientFormRow {
  key: number
  ingredientName: string
  quantity: number | ''
  unit: Unit
}

const props = withDefaults(
  defineProps<{
    recipe?: Recipe | null
  }>(),
  {
    recipe: null,
  },
)

const emit = defineEmits<{
  saved: [recipe: Recipe]
  cancel: []
}>()

let nextIngredientKey = 0

function createIngredientRow(item?: RecipeIngredient): IngredientFormRow {
  return {
    key: nextIngredientKey++,
    ingredientName: item?.ingredient.name ?? '',
    quantity: item?.quantity ?? 1,
    unit: item?.unit ?? 'GRAM',
  }
}

const dialog = ref<HTMLDialogElement | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)
const errorAlert = ref<HTMLParagraphElement | null>(null)

const title = ref(props.recipe?.title ?? '')
const ingredients = ref<IngredientFormRow[]>(
  props.recipe
    ? props.recipe.ingredients.map((item) => createIngredientRow(item))
    : [createIngredientRow()],
)
const instructions = ref(props.recipe?.instructions ?? '')
const prepTimeMinutes = ref<number | ''>(props.recipe?.prepTimeMinutes ?? 0)
const servings = ref<number | ''>(props.recipe?.servings ?? 1)
const isSaving = ref(false)
const errorMessage = ref('')

let previousScrollStyles: {
  overflow: string
  paddingRight: string
} | null = null

const isEditing = computed(() => props.recipe !== null)

const submitLabel = computed(() => {
  if (isSaving.value) {
    return 'Wird gespeichert …'
  }

  return isEditing.value ? 'Änderungen speichern' : 'Rezept speichern'
})

function lockBackgroundScroll(): void {
  const root = document.documentElement

  previousScrollStyles = {
    overflow: root.style.overflow,
    paddingRight: root.style.paddingRight,
  }

  const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth)
  const paddingRight = Number.parseFloat(getComputedStyle(root).paddingRight) || 0

  root.style.overflow = 'hidden'

  if (scrollbarWidth > 0) {
    root.style.paddingRight = `${paddingRight + scrollbarWidth}px`
  }
}

function unlockBackgroundScroll(): void {
  if (previousScrollStyles) {
    Object.assign(document.documentElement.style, previousScrollStyles)
    previousScrollStyles = null
  }
}

function cancelForm(): void {
  if (!isSaving.value) {
    emit('cancel')
  }
}

function addIngredient(): void {
  if (ingredients.value.length < 100) {
    ingredients.value.push(createIngredientRow())
  }
}

function removeIngredient(key: number): void {
  if (ingredients.value.length > 1) {
    ingredients.value = ingredients.value.filter((item) => item.key !== key)
  }
}

async function showError(message: string): Promise<void> {
  errorMessage.value = message

  await nextTick()
  errorAlert.value?.focus()
}

async function submitRecipe(): Promise<void> {
  if (isSaving.value) {
    return
  }

  errorMessage.value = ''

  const request: RecipeRequest = {
    title: title.value.trim(),
    ingredients: ingredients.value.map((item) => ({
      ingredientName: item.ingredientName.trim().replace(/\s+/g, ' '),
      quantity: Number(item.quantity),
      unit: item.unit,
    })),
    instructions: instructions.value.trim(),
    prepTimeMinutes: Number(prepTimeMinutes.value),
    servings: Number(servings.value),
  }

  if (
    !request.title ||
    !request.instructions ||
    request.ingredients.some((item) => !item.ingredientName)
  ) {
    await showError('Bitte fülle Titel, Zutaten und Zubereitung aus.')
    return
  }

  const ingredientNames = request.ingredients.map((item) => item.ingredientName.toLowerCase())

  if (new Set(ingredientNames).size !== ingredientNames.length) {
    await showError('Bitte gib jede Zutat nur einmal pro Rezept an.')
    return
  }

  isSaving.value = true

  try {
    const recipeToEdit = props.recipe

    const savedRecipe = recipeToEdit
      ? await updateRecipe(recipeToEdit.id, request)
      : await createRecipe(request)

    emit('saved', savedRecipe)
  } catch (error) {
    console.error('Rezept konnte nicht gespeichert werden:', error)

    await showError(
      'Das Rezept konnte nicht gespeichert werden. Bitte prüfe deine Eingaben und versuche es erneut.',
    )
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  if (dialog.value) {
    lockBackgroundScroll()
    dialog.value.showModal()
    titleInput.value?.focus({ preventScroll: true })
  }
})

onBeforeUnmount(() => {
  if (dialog.value?.open) {
    dialog.value.close()
  }

  unlockBackgroundScroll()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="recipe-dialog"
    aria-labelledby="recipe-form-heading"
    aria-describedby="recipe-form-description"
    :aria-busy="isSaving"
    @cancel.prevent="cancelForm"
  >
    <form class="recipe-form" @submit.prevent="submitRecipe">
      <header class="form-header">
        <div>
          <h2 id="recipe-form-heading">
            {{ isEditing ? 'Rezept bearbeiten' : 'Neues Rezept' }}
          </h2>

          <p id="recipe-form-description" class="form-description">
            Erfasse Zutaten, Mengen und Zubereitung.
          </p>
        </div>

        <button
          type="button"
          class="close-dialog-button"
          aria-label="Dialog schließen"
          :disabled="isSaving"
          @click="cancelForm"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div class="form-body">
        <p v-if="errorMessage" ref="errorAlert" class="form-error" role="alert" tabindex="-1">
          {{ errorMessage }}
        </p>

        <fieldset class="form-fields" :disabled="isSaving" aria-label="Rezeptangaben">
          <div class="field">
            <label for="recipe-title">Rezeptname</label>
            <input
              id="recipe-title"
              ref="titleInput"
              v-model="title"
              type="text"
              maxlength="200"
              placeholder="Zum Beispiel: Brot"
              autofocus
              required
            />
          </div>

          <div class="form-grid">
            <div class="field">
              <label for="recipe-prep-time"> Zubereitungszeit in Minuten </label>
              <input
                id="recipe-prep-time"
                v-model.number="prepTimeMinutes"
                type="number"
                min="0"
                max="2147483647"
                step="1"
                required
              />
            </div>

            <div class="field">
              <label for="recipe-servings">Portionen</label>
              <input
                id="recipe-servings"
                v-model.number="servings"
                type="number"
                min="1"
                max="2147483647"
                step="1"
                required
              />
            </div>
          </div>

          <section aria-labelledby="ingredients-heading">
            <h3 id="ingredients-heading">Zutaten</h3>

            <div v-for="(item, index) in ingredients" :key="item.key" class="ingredient-row">
              <div class="field ingredient-name">
                <label :for="`ingredient-name-${item.key}`"> Zutat {{ index + 1 }} </label>
                <input
                  :id="`ingredient-name-${item.key}`"
                  v-model="item.ingredientName"
                  type="text"
                  maxlength="100"
                  placeholder="Zum Beispiel: Mehl"
                  required
                />
              </div>

              <div class="field">
                <label :for="`ingredient-quantity-${item.key}`"> Menge </label>
                <input
                  :id="`ingredient-quantity-${item.key}`"
                  v-model.number="item.quantity"
                  type="number"
                  min="0.001"
                  max="9999999999.999"
                  step="0.001"
                  required
                />
              </div>

              <div class="field">
                <label :for="`ingredient-unit-${item.key}`"> Einheit </label>
                <select :id="`ingredient-unit-${item.key}`" v-model="item.unit" required>
                  <option v-for="(label, unit) in unitLabels" :key="unit" :value="unit">
                    {{ label }}
                  </option>
                </select>
              </div>

              <button
                type="button"
                class="secondary-button remove-button"
                :disabled="ingredients.length === 1"
                :aria-label="`Zutat ${index + 1} entfernen`"
                @click="removeIngredient(item.key)"
              >
                Entfernen
              </button>
            </div>

            <button
              type="button"
              class="secondary-button add-button"
              :disabled="ingredients.length >= 100"
              @click="addIngredient"
            >
              Zutat hinzufügen
            </button>
          </section>

          <div class="field">
            <label for="recipe-instructions">Zubereitung</label>
            <textarea
              id="recipe-instructions"
              v-model="instructions"
              rows="6"
              maxlength="10000"
              placeholder="Beschreibe die Zubereitung."
              required
            ></textarea>
          </div>
        </fieldset>
      </div>

      <footer class="form-actions">
        <button type="button" class="secondary-button" :disabled="isSaving" @click="cancelForm">
          Abbrechen
        </button>

        <button type="submit" class="primary-button" :disabled="isSaving">
          {{ submitLabel }}
        </button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.recipe-dialog {
  position: fixed;
  inset: 0;
  width: min(760px, calc(100vw - 32px));
  height: fit-content;
  max-height: calc(100dvh - 32px);
  margin: auto;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  color: #263b32;
  background-color: #ffffff;
  box-shadow: 0 24px 80px rgb(0 0 0 / 25%);
}

.recipe-dialog::backdrop {
  background-color: rgb(16 29 22 / 45%);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}

.recipe-form {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: calc(100dvh - 34px);
  margin: 0;
}

.form-header {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 28px;
  border-bottom: 1px solid var(--color-border);
}

.form-header > div {
  min-width: 0;
}

h2 {
  margin: 0;
  font-family: Georgia, serif;
  font-size: 1.8rem;
  line-height: 1.2;
}

h3 {
  margin: 0;
  font-size: 1.1rem;
}

.form-description {
  margin: 12px 0 0;
  color: var(--color-muted);
  font-size: 0.9rem;
  line-height: 1.6;
}

.form-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 24px 28px;
  overflow-y: auto;
}

.form-fields {
  display: grid;
  gap: 24px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

label {
  font-size: 0.9rem;
  font-weight: 600;
}

input,
select,
textarea {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: inherit;
  background-color: #ffffff;
  font: inherit;
}

textarea {
  resize: vertical;
}

.ingredient-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px 100px auto;
  align-items: end;
  gap: 12px;
  padding-block: 16px;
  border-bottom: 1px solid var(--color-border);
}

button {
  min-height: 44px;
  padding: 10px 16px;
  border-radius: 8px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.primary-button {
  border: 1px solid var(--color-primary);
  color: #ffffff;
  background-color: var(--color-primary);
}

.secondary-button {
  border: 1px solid var(--color-border);
  color: var(--color-primary);
  background-color: #ffffff;
}

.close-dialog-button {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 44px;
  padding: 0;
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  background-color: #ffffff;
  font-size: 1.7rem;
  line-height: 1;
}

.close-dialog-button:hover:not(:disabled) {
  background-color: #f1f4ee;
}

.add-button {
  margin-top: 16px;
}

.form-actions {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 28px;
  border-top: 1px solid var(--color-border);
  background-color: #ffffff;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

input:focus-visible,
select:focus-visible,
textarea:focus-visible,
button:focus-visible,
.form-error:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

.form-error {
  margin: 0 0 24px;
  color: #9e2a2b;
  line-height: 1.6;
}

@media (max-width: 700px) {
  .form-header,
  .form-body,
  .form-actions {
    padding: 20px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .ingredient-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ingredient-name {
    grid-column: 1 / -1;
  }

  .remove-button {
    grid-column: 1 / -1;
    justify-self: start;
  }
}

@media (max-width: 520px) {
  .form-actions {
    flex-direction: column;
  }

  .form-actions button {
    width: 100%;
  }
}
</style>
