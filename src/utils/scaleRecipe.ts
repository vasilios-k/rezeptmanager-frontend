import type { Recipe, RecipeIngredient } from '@/types/recipe'

export const MAX_SERVINGS = 2_147_483_647

export function isValidServings(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_SERVINGS
}

export function scaleRecipeIngredients(recipe: Recipe, targetServings: number): RecipeIngredient[] {
  if (!isValidServings(recipe.servings) || !isValidServings(targetServings)) {
    throw new RangeError('Die Portionszahl muss eine gültige positive ganze Zahl sein.')
  }

  if (targetServings < recipe.servings) {
    throw new RangeError('Die Portionszahl darf nicht unter der Originalportionszahl liegen.')
  }

  const factor = targetServings / recipe.servings

  return recipe.ingredients.map((item) => ({
    ...item,
    quantity: item.quantity * factor,
  }))
}
