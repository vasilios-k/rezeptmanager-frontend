import { reactive, readonly, watch } from 'vue'
import { activeAccount, readAccountStorage, writeAccountStorage } from '@/auth/accountScope'
import type { Recipe } from '@/types/recipe'
import type { ShoppingListState, ShoppingRecipeSelection } from '@/types/shoppingList'
import { isValidServings } from '@/utils/scaleRecipe'

const storageKey = 'rezeptmanager.shopping-list.v1'

function isSelection(value: unknown): value is ShoppingRecipeSelection {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Partial<ShoppingRecipeSelection>

  return (
    typeof candidate.recipeId === 'number' &&
    Number.isSafeInteger(candidate.recipeId) &&
    candidate.recipeId > 0 &&
    isValidServings(candidate.servings)
  )
}

function loadState(): ShoppingListState {
  try {
    const parsed: unknown = JSON.parse(readAccountStorage(storageKey) ?? 'null')

    if (typeof parsed === 'object' && parsed !== null) {
      const saved = parsed as { selections?: unknown; checkedKeys?: unknown }
      const selections = Array.isArray(saved.selections)
        ? saved.selections
            .filter(isSelection)
            .map(({ recipeId, servings }) => ({ recipeId, servings }))
        : []
      const checkedKeys = Array.isArray(saved.checkedKeys)
        ? saved.checkedKeys.filter((key): key is string => typeof key === 'string')
        : []

      return {
        selections: Array.from(new Map(selections.map((item) => [item.recipeId, item])).values()),
        checkedKeys: [...new Set(checkedKeys)],
      }
    }
  } catch {
    // Auch bei beschädigten oder nicht verfügbaren Browserdaten bleibt die Seite nutzbar.
  }

  return { selections: [], checkedKeys: [] }
}

const state = reactive(loadState())
export const shoppingListState = readonly(state)

watch(
  activeAccount,
  () => {
    const next = loadState()
    state.selections = next.selections
    state.checkedKeys = next.checkedKeys
  },
  { flush: 'sync' },
)

function saveState(): void {
  try {
    writeAccountStorage(storageKey, JSON.stringify(state))
  } catch {
    // Die aktuelle Auswahl bleibt für diese Sitzung erhalten.
  }
}

export function replaceShoppingList(next: ShoppingListState): void {
  if (!activeAccount.value) return
  state.selections = next.selections.map((item) => ({ ...item }))
  state.checkedKeys = [...next.checkedKeys]
  saveState()
}

export function setShoppingRecipe(recipe: Recipe, servings: number): void {
  if (!activeAccount.value) return
  if (!isValidServings(servings)) return

  const value = Math.max(recipe.servings, servings)
  const existing = state.selections.find((item) => item.recipeId === recipe.id)

  if (existing?.servings === value) return

  if (existing) existing.servings = value
  else state.selections.push({ recipeId: recipe.id, servings: value })

  state.checkedKeys = []
  saveState()
}

export function removeShoppingRecipe(recipeId: number): void {
  if (!activeAccount.value) return
  if (!state.selections.some((item) => item.recipeId === recipeId)) return

  state.selections = state.selections.filter((item) => item.recipeId !== recipeId)
  state.checkedKeys = []
  saveState()
}

export function setShoppingItemChecked(signature: string, checked: boolean): void {
  if (!activeAccount.value) return
  const keys = new Set(state.checkedKeys)

  if (checked) keys.add(signature)
  else keys.delete(signature)

  state.checkedKeys = [...keys]
  saveState()
}

export function syncShoppingRecipes(recipes: readonly Recipe[]): number {
  if (!activeAccount.value) return 0
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const removedCount = state.selections.filter((item) => !recipesById.has(item.recipeId)).length
  const nextSelections = state.selections.flatMap((item) => {
    const recipe = recipesById.get(item.recipeId)

    return recipe
      ? [{ recipeId: item.recipeId, servings: Math.max(recipe.servings, item.servings) }]
      : []
  })

  if (JSON.stringify(nextSelections) !== JSON.stringify(state.selections)) {
    state.selections = nextSelections
    state.checkedKeys = []
    saveState()
  }

  return removedCount
}

export function pruneShoppingChecks(signatures: readonly string[]): void {
  if (!activeAccount.value) return
  const validKeys = new Set(signatures)
  const checkedKeys = state.checkedKeys.filter((key) => validKeys.has(key))

  if (checkedKeys.length === state.checkedKeys.length) return

  state.checkedKeys = checkedKeys
  saveState()
}
