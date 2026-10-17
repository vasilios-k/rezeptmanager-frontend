import type { Ingredient, Recipe } from '@/types/recipe'

const flour: Ingredient = { id: 1, name: 'Mehl' }
const eggs: Ingredient = { id: 2, name: 'Eier' }
const milk: Ingredient = { id: 3, name: 'Milch' }
const water: Ingredient = { id: 4, name: 'Wasser' }
const dryYeast: Ingredient = { id: 5, name: 'Trockenhefe' }
const salt: Ingredient = { id: 6, name: 'Salz' }

export const exampleRecipes: Recipe[] = [
  {
    id: 1,
    title: 'Pfannkuchen',
    ingredients: [
      { ingredient: flour, quantity: 200, unit: 'GRAM' },
      { ingredient: eggs, quantity: 2, unit: 'PIECE' },
      { ingredient: milk, quantity: 300, unit: 'MILLILITER' },
    ],
    instructions: 'Zutaten verrühren und portionsweise in einer Pfanne ausbacken.',
    prepTimeMinutes: 25,
    servings: 2,
  },
  {
    id: 2,
    title: 'Brot',
    ingredients: [
      { ingredient: flour, quantity: 500, unit: 'GRAM' },
      { ingredient: water, quantity: 300, unit: 'MILLILITER' },
      { ingredient: dryYeast, quantity: 7, unit: 'GRAM' },
      { ingredient: salt, quantity: 1, unit: 'TEASPOON' },
    ],
    instructions: 'Zutaten verkneten. Den Teig gehen lassen, einen Laib formen und im Ofen backen.',
    prepTimeMinutes: 90,
    servings: 4,
  },
]
