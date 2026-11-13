<script setup lang="ts">
import { ref } from 'vue'
import { createRecipe } from '@/services/recipeService'
import type { CreateRecipeRequest, Recipe, Unit } from '@/types/recipe'
import { unitLabels } from '@/utils/formatIngredient'

interface IngredientFormRow {
  key: number
  ingredientName: string
  quantity: number | ''
  unit: Unit
}

const emit = defineEmits<{
  created: [recipe: Recipe]
  cancel: []
}>()

let nextIngredientKey = 0

function createIngredientRow(): IngredientFormRow {
  return {
    key: nextIngredientKey++,
    ingredientName: '',
    quantity: 1,
    unit: 'GRAM',
  }
}

const title = ref('')
const ingredients = ref<IngredientFormRow[]>([createIngredientRow()])
const instructions = ref('')
const prepTimeMinutes = ref<number | ''>(0)
const servings = ref<number | ''>(1)
const isSaving = ref(false)
const errorMessage = ref('')

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

async function submitRecipe(): Promise<void> {
  if (isSaving.value) {
    return
  }

  errorMessage.value = ''

  const request: CreateRecipeRequest = {
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
    errorMessage.value = 'Bitte fülle Titel, Zutaten und Zubereitung aus.'
    return
  }

  const ingredientNames = request.ingredients.map((item) => item.ingredientName.toLowerCase())

  if (new Set(ingredientNames).size !== ingredientNames.length) {
    errorMessage.value = 'Bitte gib jede Zutat nur einmal pro Rezept an.'
    return
  }

  isSaving.value = true

  try {
    const savedRecipe = await createRecipe(request)
    emit('created', savedRecipe)
  } catch (error) {
    console.error('Rezept konnte nicht gespeichert werden:', error)
    errorMessage.value =
      'Das Rezept konnte nicht gespeichert werden. Bitte prüfe deine Eingaben und versuche es erneut.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <form
    class="recipe-form"
    aria-labelledby="recipe-form-heading"
    :aria-busy="isSaving"
    @submit.prevent="submitRecipe"
  >
    <h2 id="recipe-form-heading">Neues Rezept</h2>
    <p class="form-description">Erfasse Zutaten, Mengen und Zubereitung.</p>

    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>

    <fieldset class="form-fields" :disabled="isSaving" aria-label="Rezeptangaben">
      <div class="field">
        <label for="recipe-title">Rezeptname</label>
        <input
          id="recipe-title"
          v-model="title"
          type="text"
          maxlength="200"
          placeholder="Zum Beispiel: Brot"
          required
        />
      </div>

      <div class="form-grid">
        <div class="field">
          <label for="recipe-prep-time">Zubereitungszeit in Minuten</label>
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
            <label :for="`ingredient-name-${item.key}`">Zutat {{ index + 1 }}</label>
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
            <label :for="`ingredient-quantity-${item.key}`">Menge</label>
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
            <label :for="`ingredient-unit-${item.key}`">Einheit</label>
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

      <div class="form-actions">
        <button type="submit" class="primary-button">
          {{ isSaving ? 'Wird gespeichert …' : 'Rezept speichern' }}
        </button>

        <button type="button" class="secondary-button" @click="emit('cancel')">Abbrechen</button>
      </div>
    </fieldset>
  </form>
</template>

<style scoped>
.recipe-form {
  margin-bottom: 32px;
  padding: 28px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background-color: #ffffff;
}

h2 {
  margin: 0;
  font-family: Georgia, serif;
  font-size: 1.8rem;
}

h3 {
  margin: 0;
  font-size: 1.1rem;
}

.form-description {
  margin: 12px 0 24px;
  color: var(--color-muted);
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

.add-button {
  margin-top: 16px;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

input:focus-visible,
select:focus-visible,
textarea:focus-visible,
button:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

.form-error {
  margin-bottom: 24px;
  color: #9e2a2b;
  line-height: 1.6;
}

@media (max-width: 700px) {
  .recipe-form {
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
</style>
