import type { Recipe, RecipeIngredient } from '@/types/recipe'
import type { ShoppingListItem, ShoppingRecipeSelection } from '@/types/shoppingList'
import { isValidServings, scaleRecipeIngredients } from '@/utils/scaleRecipe'

const collator = new Intl.Collator('de-DE', { sensitivity: 'base' })

function toBaseUnit(item: RecipeIngredient): RecipeIngredient {
  if (item.unit === 'KILOGRAM') {
    return { ...item, quantity: item.quantity * 1000, unit: 'GRAM' }
  }

  if (item.unit === 'LITER') {
    return { ...item, quantity: item.quantity * 1000, unit: 'MILLILITER' }
  }

  return { ...item }
}

function toDisplayUnit(item: RecipeIngredient): RecipeIngredient {
  if (item.unit === 'GRAM' && item.quantity >= 1000) {
    return { ...item, quantity: item.quantity / 1000, unit: 'KILOGRAM' }
  }

  if (item.unit === 'MILLILITER' && item.quantity >= 1000) {
    return { ...item, quantity: item.quantity / 1000, unit: 'LITER' }
  }

  return item
}

export function buildShoppingList(
  recipes: readonly Recipe[],
  selections: readonly ShoppingRecipeSelection[],
): ShoppingListItem[] {
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const servingsById = new Map(
    selections.map((selection) => [selection.recipeId, selection.servings]),
  )
  const totals = new Map<string, RecipeIngredient>()

  for (const [recipeId, servings] of servingsById) {
    const recipe = recipesById.get(recipeId)

    if (!recipe || !isValidServings(servings)) continue

    const ingredients = scaleRecipeIngredients(recipe, Math.max(recipe.servings, servings))

    for (const ingredient of ingredients) {
      const item = toBaseUnit(ingredient)
      const key = `${item.ingredient.id}:${item.unit}`
      const existing = totals.get(key)

      if (existing) existing.quantity += item.quantity
      else totals.set(key, item)
    }
  }

  return Array.from(totals, ([key, item]) => ({
    ...toDisplayUnit(item),
    key,
    signature: `${key}:${item.quantity}`,
  })).sort(
    (first, second) =>
      collator.compare(first.ingredient.name, second.ingredient.name) ||
      collator.compare(first.unit, second.unit),
  )
}
