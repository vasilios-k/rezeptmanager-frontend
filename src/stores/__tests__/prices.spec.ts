import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecipeIngredient } from '@/types/recipe'
import type { ProductPrice } from '@/types/prices'

const item: RecipeIngredient = {
  ingredient: { id: 1, name: 'Mehl' },
  quantity: 200,
  unit: 'GRAM',
}

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

beforeEach(async () => {
  vi.resetModules()
  const { setActiveAccount } = await import('@/auth/accountScope')
  setActiveAccount('auth0|test-user')
  localStorage.clear()
})

afterEach(() => vi.restoreAllMocks())

describe('price storage', () => {
  it('speichert Preiszuordnung und Vorratsmarkierung getrennt vom Rezept und stellt sie wieder her', async () => {
    const store = await import('@/stores/prices')

    store.setIngredientPrice(item, price)
    store.setIngredientInPantry(item, true)

    vi.resetModules()
    const { setActiveAccount } = await import('@/auth/accountScope')
    setActiveAccount('auth0|test-user')
    const restored = await import('@/stores/prices')

    expect(restored.priceState.prices['1:GRAM']).toEqual(price)
    expect(restored.priceState.pantry['1:GRAM']).toBe('1:GRAM:200')
    expect(item.quantity).toBe(200)
  })

  it('weist falsche Einheiten und ungültige Preise zurück', async () => {
    const store = await import('@/stores/prices')

    expect(() => store.setIngredientPrice(item, { ...price, packageUnit: 'MILLILITER' })).toThrow(
      RangeError,
    )

    expect(() => store.setIngredientPrice(item, { ...price, packageQuantity: 0 })).toThrow(
      RangeError,
    )

    expect(store.priceState.prices).toEqual({})
  })

  it('entfernt Preiszuordnungen und Vorratsmarkierungen', async () => {
    const store = await import('@/stores/prices')

    store.setIngredientPrice(item, price)
    store.setIngredientInPantry(item, true)
    store.removeIngredientPrice(item)
    store.setIngredientInPantry(item, false)

    expect(store.priceState).toEqual({ prices: {}, pantry: {} })
  })

  it('ignoriert beschädigte und unpassende gespeicherte Daten', async () => {
    localStorage.setItem(
      'rezeptmanager.prices.v1:auth0%7Ctest-user',
      JSON.stringify({
        prices: {
          '1:GRAM': { ...price, currency: 'USD' },
          '2:MILLILITER': price,
          invalid: price,
        },
        pantry: { invalid: 'yes' },
      }),
    )

    const store = await import('@/stores/prices')

    expect(store.priceState).toEqual({ prices: {}, pantry: {} })
  })

  it('bleibt bei gesperrtem Browserspeicher bedienbar', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Gesperrt')
    })

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Gesperrt')
    })

    const store = await import('@/stores/prices')

    expect(() => store.setIngredientPrice(item, price)).not.toThrow()
    expect(store.priceState.prices['1:GRAM']).toEqual(price)
  })
})
