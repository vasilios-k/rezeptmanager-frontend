export type Unit =
  'GRAM' | 'KILOGRAM' | 'MILLILITER' | 'LITER' | 'TEASPOON' | 'TABLESPOON' | 'PIECE' | 'PINCH'

export interface Ingredient {
  id: number
  name: string
}

export interface RecipeIngredient {
  ingredient: Ingredient
  quantity: number
  unit: Unit
}

export interface Recipe {
  id: number
  title: string
  ingredients: RecipeIngredient[]
  instructions: string
  prepTimeMinutes: number
  servings: number
}
