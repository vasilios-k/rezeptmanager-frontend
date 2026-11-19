import { describe, expect, it } from 'vitest'
import type { Recipe, RecipeIngredient, Unit } from '@/types/recipe'
import { formatIngredientAmount } from '@/utils/formatIngredient'
import { MAX_SERVINGS, scaleRecipeIngredients } from '@/utils/scaleRecipe'

const recipe: Recipe = {
  id: 1,
  title: 'Testrezept',
  ingredients: [
    { ingredient: { id: 1, name: 'Mehl' }, quantity: 200, unit: 'GRAM' },
    { ingredient: { id: 2, name: 'Ei' }, quantity: 1, unit: 'PIECE' },
    { ingredient: { id: 3, name: 'Salz' }, quantity: 0.25, unit: 'TEASPOON' },
  ],
  instructions: 'Zutaten vermischen.',
  prepTimeMinutes: 10,
  servings: 2,
}

describe('scaleRecipeIngredients', () => {
  it('skaliert alle Mengen mit demselben Faktor und erhält die Einheiten', () => {
    expect(scaleRecipeIngredients(recipe, 4)).toEqual([
      { ingredient: { id: 1, name: 'Mehl' }, quantity: 400, unit: 'GRAM' },
      { ingredient: { id: 2, name: 'Ei' }, quantity: 2, unit: 'PIECE' },
      { ingredient: { id: 3, name: 'Salz' }, quantity: 0.5, unit: 'TEASPOON' },
    ])
  })

  it('rundet Mengen bei der Berechnung nicht auf ganze Zahlen', () => {
    const scaled = scaleRecipeIngredients({ ...recipe, servings: 3 }, 4)

    expect(scaled[0]?.quantity).toBeCloseTo(266.6666666667, 8)
    expect(scaled[1]?.quantity).toBeCloseTo(1.3333333333, 8)
    expect(scaled[2]?.quantity).toBeCloseTo(0.3333333333, 8)
  })

  it('verändert das Originalrezept nicht', () => {
    const original = structuredClone(recipe)
    const scaled = scaleRecipeIngredients(recipe, 6)

    expect(recipe).toEqual(original)
    expect(scaled).not.toBe(recipe.ingredients)
    expect(scaled[0]).not.toBe(recipe.ingredients[0])
  })

  it('lehnt eine Portionszahl unterhalb des Originalwerts ab', () => {
    expect(() => scaleRecipeIngredients(recipe, 1)).toThrow(RangeError)
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_SERVINGS + 1])(
    'lehnt die ungültige Zielportion %s ab',
    (servings) => {
      expect(() => scaleRecipeIngredients(recipe, servings)).toThrow(RangeError)
    },
  )

  it('verhindert eine Division durch eine ungültige Originalportionszahl', () => {
    expect(() => scaleRecipeIngredients({ ...recipe, servings: 0 }, 2)).toThrow(RangeError)
  })
})

describe('formatIngredientAmount', () => {
  const examples: [number, Unit, string][] = [
    [200 / 3, 'GRAM', '66,667 g'],
    [0.1 + 0.2, 'LITER', '0,3 l'],
    [0.00001, 'GRAM', '< 0,001 g'],
    [0.5, 'PIECE', '0,5 Stk.'],
    [1, 'PINCH', '1 Prise'],
    [2, 'PINCH', '2 Prisen'],
    [1.0000000000000002, 'PINCH', '1 Prise'],
  ]

  it.each(examples)('formatiert %s %s als "%s"', (quantity, unit, expected) => {
    const item: RecipeIngredient = {
      ingredient: { id: 1, name: 'Testzutat' },
      quantity,
      unit,
    }

    expect(formatIngredientAmount(item)).toBe(expected)
  })
})
