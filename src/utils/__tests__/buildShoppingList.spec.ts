import { describe, expect, it } from 'vitest'
import type { Recipe, RecipeIngredient } from '@/types/recipe'
import { buildShoppingList } from '@/utils/buildShoppingList'

const flour = { id: 1, name: 'Mehl' }
const milk = { id: 2, name: 'Milch' }

function recipe(id: number, ingredients: RecipeIngredient[], servings = 2): Recipe {
  return {
    id,
    title: `Rezept ${id}`,
    ingredients,
    servings,
    instructions: 'Zubereiten.',
    prepTimeMinutes: 10,
  }
}

describe('buildShoppingList', () => {
  it('skaliert Portionen und addiert Gramm und Kilogramm', () => {
    const recipes = [
      recipe(1, [{ ingredient: flour, quantity: 200, unit: 'GRAM' }]),
      recipe(2, [{ ingredient: flour, quantity: 1, unit: 'KILOGRAM' }]),
    ]
    const items = buildShoppingList(recipes, [
      { recipeId: 1, servings: 4 },
      { recipeId: 2, servings: 2 },
    ])

    expect(items).toEqual([
      expect.objectContaining({ ingredient: flour, quantity: 1.4, unit: 'KILOGRAM' }),
    ])
  })

  it('addiert Milliliter und Liter und wählt eine passende Anzeigeeinheit', () => {
    const recipes = [
      recipe(1, [{ ingredient: milk, quantity: 300, unit: 'MILLILITER' }]),
      recipe(2, [{ ingredient: milk, quantity: 0.5, unit: 'LITER' }]),
    ]

    expect(
      buildShoppingList(recipes, [
        { recipeId: 1, servings: 2 },
        { recipeId: 2, servings: 2 },
      ]),
    ).toEqual([expect.objectContaining({ quantity: 800, unit: 'MILLILITER' })])

    expect(
      buildShoppingList(recipes, [
        { recipeId: 1, servings: 4 },
        { recipeId: 2, servings: 2 },
      ]),
    ).toEqual([expect.objectContaining({ quantity: 1.1, unit: 'LITER' })])
  })

  it('trennt unvereinbare Einheiten und unterschiedliche Zutaten-IDs', () => {
    const recipes = [
      recipe(1, [
        { ingredient: flour, quantity: 200, unit: 'GRAM' },
        { ingredient: flour, quantity: 1, unit: 'TABLESPOON' },
        { ingredient: { id: 3, name: 'Mehl' }, quantity: 50, unit: 'GRAM' },
      ]),
    ]

    expect(buildShoppingList(recipes, [{ recipeId: 1, servings: 2 }])).toHaveLength(3)
  })

  it('zählt dasselbe Rezept einmal und ignoriert fehlende Rezepte oder ungültige Portionen', () => {
    const recipes = [recipe(1, [{ ingredient: flour, quantity: 200, unit: 'GRAM' }])]

    expect(
      buildShoppingList(recipes, [
        { recipeId: 1, servings: 2 },
        { recipeId: 1, servings: 4 },
        { recipeId: 99, servings: 2 },
        { recipeId: 2, servings: 0 },
      ]),
    ).toEqual([expect.objectContaining({ quantity: 400 })])

    expect(buildShoppingList(recipes, [{ recipeId: 1, servings: 0 }])).toEqual([])
  })

  it('unterschreitet bei geänderten Rezepten die Originalportionen nicht', () => {
    const recipes = [recipe(1, [{ ingredient: flour, quantity: 200, unit: 'GRAM' }], 4)]

    expect(buildShoppingList(recipes, [{ recipeId: 1, servings: 2 }])).toEqual([
      expect.objectContaining({ quantity: 200 }),
    ])
  })

  it('sortiert alphabetisch und verändert die Originaldaten nicht', () => {
    const recipes = [
      recipe(1, [
        { ingredient: milk, quantity: 300, unit: 'MILLILITER' },
        { ingredient: flour, quantity: 200, unit: 'GRAM' },
      ]),
    ]
    const original = JSON.stringify(recipes)
    const items = buildShoppingList(recipes, [{ recipeId: 1, servings: 4 }])

    expect(items.map((item) => item.ingredient.name)).toEqual(['Mehl', 'Milch'])
    expect(JSON.stringify(recipes)).toBe(original)
  })

  it('ändert bei neuen Mengen die Häkchen-Signatur und behält den Zeilenschlüssel', () => {
    const recipes = [recipe(1, [{ ingredient: flour, quantity: 200, unit: 'GRAM' }])]
    const [original] = buildShoppingList(recipes, [{ recipeId: 1, servings: 2 }])
    const [scaled] = buildShoppingList(recipes, [{ recipeId: 1, servings: 4 }])

    expect(original?.key).toBe(scaled?.key)
    expect(original?.signature).not.toBe(scaled?.signature)
  })
})
