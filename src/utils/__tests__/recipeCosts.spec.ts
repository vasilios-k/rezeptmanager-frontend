import { describe, expect, it } from 'vitest'
import type { RecipeIngredient } from '@/types/recipe'
import type { ProductPrice } from '@/types/prices'
import {
  amountSignature,
  calculateCosts,
  formatMoney,
  formatPackage,
  isPriceDate,
  isProductPrice,
  parseEuroCents,
  priceKey,
} from '@/utils/recipeCosts'

const flour: RecipeIngredient = {
  ingredient: { id: 1, name: 'Mehl' },
  quantity: 200,
  unit: 'GRAM',
}

const price: ProductPrice = {
  priceId: null,
  productId: null,
  productName: 'Weizenmehl 405',
  packageQuantity: 1000,
  packageUnit: 'GRAM',
  priceCents: 120,
  currency: 'EUR',
  shop: 'Testmarkt',
  city: null,
  priceDate: '2025-01-01',
  source: 'MANUAL',
}

describe('recipe costs', () => {
  it('unterscheidet verbrauchte Zutaten und ganze Einkaufspackungen', () => {
    const [row] = calculateCosts([flour], { '1:GRAM': price })

    expect(row).toMatchObject({
      consumptionCents: 24,
      packages: 1,
      purchaseCents: 120,
    })

    const [larger] = calculateCosts([{ ...flour, quantity: 1200 }], { '1:GRAM': price })

    expect(larger).toMatchObject({
      consumptionCents: 144,
      packages: 2,
      purchaseCents: 240,
    })
  })

  it('verwendet dieselbe Zuordnung für Gramm und Kilogramm', () => {
    const item: RecipeIngredient = {
      ...flour,
      quantity: 0.2,
      unit: 'KILOGRAM',
    }

    expect(priceKey(item)).toBe(priceKey(flour))
    expect(calculateCosts([item], { '1:GRAM': price })[0]?.consumptionCents).toBe(24)
    expect(formatPackage(price)).toBe('1 kg')
  })

  it('behandelt fehlende Preise und inkompatible Einheiten als unbekannt', () => {
    expect(calculateCosts([flour], {})[0]).toMatchObject({
      consumptionCents: null,
      purchaseCents: null,
    })

    expect(
      calculateCosts([flour], { '1:GRAM': { ...price, packageUnit: 'MILLILITER' } })[0]
        ?.consumptionCents,
    ).toBeNull()

    const salt: RecipeIngredient = { ...flour, unit: 'TEASPOON' }

    expect(calculateCosts([salt], { '1:GRAM': price })[0]?.consumptionCents).toBeNull()

    expect(formatMoney(null)).toBe('—')
  })

  it('zieht Vorräte nur vom Einkaufsbetrag für die markierte Menge ab', () => {
    const pantry = { '1:GRAM': amountSignature(flour) }

    expect(calculateCosts([flour], { '1:GRAM': price }, pantry)[0]).toMatchObject({
      consumptionCents: 24,
      packages: 0,
      purchaseCents: 0,
      inPantry: true,
    })

    expect(
      calculateCosts([{ ...flour, quantity: 400 }], { '1:GRAM': price }, pantry)[0]?.inPantry,
    ).toBe(false)

    expect(calculateCosts([flour], {}, pantry)[0]).toMatchObject({
      consumptionCents: null,
      purchaseCents: 0,
    })
  })

  it('kauft wegen Gleitkommaungenauigkeit keine zusätzliche Packung', () => {
    const item = { ...flour, quantity: 0.1 + 0.2 }

    expect(
      calculateCosts([item], { '1:GRAM': { ...price, packageQuantity: 0.3 } })[0]?.packages,
    ).toBe(1)

    expect(
      calculateCosts([{ ...flour, quantity: 0.000000001 }], { '1:GRAM': price })[0]?.packages,
    ).toBe(1)
  })

  it('rundet Zutatenkosten erst bei der Anzeige und akzeptiert ausdrücklich kostenlose Produkte', () => {
    const [row] = calculateCosts([{ ...flour, quantity: 1 }], { '1:GRAM': price })

    expect(row?.consumptionCents).toBeCloseTo(0.12)

    expect(
      calculateCosts([flour], { '1:GRAM': { ...price, priceCents: 0 } })[0]?.consumptionCents,
    ).toBe(0)
  })

  it('liest deutsche und englische Dezimalpreise ohne Rundungsfehler', () => {
    expect(parseEuroCents('1,29')).toBe(129)
    expect(parseEuroCents('1.29')).toBe(129)
    expect(parseEuroCents('0')).toBe(0)

    for (const value of ['-1', '1,234', 'NaN', '', '1.000,00']) {
      expect(parseEuroCents(value)).toBeNull()
    }
  })

  it('prüft gespeicherte Preise und Datumsangaben', () => {
    expect(isProductPrice(price)).toBe(true)
    expect(isProductPrice({ ...price, currency: 'USD' })).toBe(false)
    expect(isProductPrice({ ...price, packageQuantity: 0 })).toBe(false)
    expect(isProductPrice({ ...price, priceCents: 1.5 })).toBe(false)
    expect(isPriceDate('2025-02-30')).toBe(false)
    expect(isPriceDate('9999-12-31')).toBe(false)
  })
})
