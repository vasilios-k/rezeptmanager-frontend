import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exampleRecipes } from '@/data/exampleRecipes'
import type { ProductPrice } from '@/types/prices'

const alice = 'auth0|alice'
const bob = 'auth0|bob'
const recipe = exampleRecipes[0]!
const item = recipe.ingredients[0]!
const price: ProductPrice = {
  priceId: null,
  productId: null,
  productName: 'Mehl',
  packageQuantity: 1000,
  packageUnit: 'GRAM',
  priceCents: 120,
  currency: 'EUR',
  shop: 'Testmarkt',
  city: null,
  priceDate: '2025-01-01',
  source: 'MANUAL',
}

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  vi.stubEnv('VITE_LEGACY_OWNER_SUBJECT', alice)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

async function stores() {
  const scope = await import('@/auth/accountScope')
  const shopping = await import('@/stores/shoppingList')
  const prices = await import('@/stores/prices')
  return { scope, shopping, prices }
}

describe('Kontentrennung im Browserspeicher', () => {
  it('trennt Einkaufsliste, Häkchen, Preise und Vorräte zwischen zwei Konten', async () => {
    const { scope, shopping, prices } = await stores()
    scope.setActiveAccount(alice)
    shopping.setShoppingRecipe(recipe, 4)
    shopping.setShoppingItemChecked('1:GRAM:400', true)
    prices.setIngredientPrice(item, price)
    prices.setIngredientInPantry(item, true)

    scope.setActiveAccount(bob)

    expect(shopping.shoppingListState).toEqual({ selections: [], checkedKeys: [] })
    expect(prices.priceState).toEqual({ prices: {}, pantry: {} })

    shopping.setShoppingRecipe(recipe, 6)
    prices.setIngredientPrice(item, { ...price, priceCents: 180 })

    scope.setActiveAccount(alice)

    expect(shopping.shoppingListState.selections).toEqual([{ recipeId: recipe.id, servings: 4 }])
    expect(shopping.shoppingListState.checkedKeys).toEqual(['1:GRAM:400'])
    expect(prices.priceState.prices['1:GRAM']?.priceCents).toBe(120)
    expect(prices.priceState.pantry['1:GRAM']).toBe('1:GRAM:200')

    scope.setActiveAccount(bob)

    expect(shopping.shoppingListState.selections[0]?.servings).toBe(6)
    expect(prices.priceState.prices['1:GRAM']?.priceCents).toBe(180)
    expect(prices.priceState.pantry).toEqual({})
  })

  it('leert beim Abmelden den sichtbaren Zustand und verhindert anonyme Änderungen', async () => {
    const { scope, shopping, prices } = await stores()
    scope.setActiveAccount(alice)
    shopping.setShoppingRecipe(recipe, 4)
    prices.setIngredientPrice(item, price)

    scope.setActiveAccount(null)
    shopping.setShoppingRecipe(recipe, 6)
    prices.setIngredientPrice(item, { ...price, priceCents: 200 })

    expect(shopping.shoppingListState.selections).toEqual([])
    expect(prices.priceState.prices).toEqual({})

    scope.setActiveAccount(alice)

    expect(shopping.shoppingListState.selections[0]?.servings).toBe(4)
    expect(prices.priceState.prices['1:GRAM']?.priceCents).toBe(120)
  })

  it('übernimmt die bisherigen Browserdaten ausschließlich für den ausdrücklich festgelegten Besitzer', async () => {
    localStorage.setItem(
      'rezeptmanager.shopping-list.v1',
      JSON.stringify({
        selections: [{ recipeId: recipe.id, servings: 4 }],
        checkedKeys: ['1:GRAM:400'],
      }),
    )
    localStorage.setItem(
      'rezeptmanager.prices.v1',
      JSON.stringify({
        prices: { '1:GRAM': price },
        pantry: { '1:GRAM': '1:GRAM:200' },
      }),
    )

    const { scope, shopping, prices } = await stores()
    scope.setActiveAccount(bob)

    expect(shopping.shoppingListState.selections).toEqual([])
    expect(prices.priceState.prices).toEqual({})
    expect(localStorage.getItem('rezeptmanager.prices.v1')).not.toBeNull()

    scope.setActiveAccount(alice)

    expect(shopping.shoppingListState.selections[0]?.servings).toBe(4)
    expect(prices.priceState.prices['1:GRAM']).toEqual(price)
    expect(prices.priceState.pantry['1:GRAM']).toBe('1:GRAM:200')
    expect(localStorage.getItem('rezeptmanager.shopping-list.v1')).toBeNull()
    expect(localStorage.getItem('rezeptmanager.prices.v1')).toBeNull()

    scope.setActiveAccount(bob)
    expect(prices.priceState.prices).toEqual({})
  })

  it('bewahrt die bisherigen Daten, wenn die Speicherung der Migration fehlschlägt', async () => {
    const legacy = JSON.stringify({
      selections: [{ recipeId: recipe.id, servings: 4 }],
      checkedKeys: [],
    })
    localStorage.setItem('rezeptmanager.shopping-list.v1', legacy)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Gesperrt')
    })

    const { scope, shopping } = await stores()
    scope.setActiveAccount(alice)

    expect(shopping.shoppingListState.selections[0]?.servings).toBe(4)
    expect(localStorage.getItem('rezeptmanager.shopping-list.v1')).toBe(legacy)
  })
})
