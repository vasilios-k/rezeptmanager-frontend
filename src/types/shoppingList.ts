import type { RecipeIngredient } from '@/types/recipe'

export interface ShoppingRecipeSelection {
  recipeId: number
  servings: number
}

export interface ShoppingListItem extends RecipeIngredient {
  key: string
  signature: string
}

export interface ShoppingListState {
  selections: ShoppingRecipeSelection[]
  checkedKeys: string[]
}
