import type { Recipe } from '@/types/recipe'

function normalizeSearchText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE')
}

export function filterRecipes(recipes: readonly Recipe[], searchTerm: string): Recipe[] {
  const query = normalizeSearchText(searchTerm)

  if (!query) {
    return [...recipes]
  }

  return recipes.filter(
    (recipe) =>
      normalizeSearchText(recipe.title).includes(query) ||
      recipe.ingredients.some((item) => normalizeSearchText(item.ingredient.name).includes(query)),
  )
}
