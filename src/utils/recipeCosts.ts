import type { RecipeIngredient, Unit } from '@/types/recipe'
import type { IngredientCost, ProductPrice } from '@/types/prices'
import { formatIngredientAmount, unitLabels } from '@/utils/formatIngredient'

const moneyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

export function baseAmount(quantity: number, unit: Unit): { quantity: number; unit: Unit } {
  if (unit === 'KILOGRAM') return { quantity: quantity * 1000, unit: 'GRAM' }
  if (unit === 'LITER') return { quantity: quantity * 1000, unit: 'MILLILITER' }
  return { quantity, unit }
}

export function priceKey(item: RecipeIngredient): string {
  return `${item.ingredient.id}:${baseAmount(item.quantity, item.unit).unit}`
}

export function amountSignature(item: RecipeIngredient): string {
  return `${priceKey(item)}:${baseAmount(item.quantity, item.unit).quantity}`
}

export function todayDate(): string {
  const date = new Date()

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function isPriceDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const time = Date.parse(`${value}T00:00:00Z`)

  return (
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value &&
    value <= todayDate()
  )
}

export function isProductPrice(value: unknown): value is ProductPrice {
  if (typeof value !== 'object' || value === null) return false

  const price = value as Partial<ProductPrice>

  return (
    typeof price.productName === 'string' &&
    price.productName.trim().length > 0 &&
    typeof price.shop === 'string' &&
    (price.city === null || typeof price.city === 'string') &&
    typeof price.packageQuantity === 'number' &&
    Number.isFinite(price.packageQuantity) &&
    price.packageQuantity > 0 &&
    price.packageQuantity <= 1_000_000_000 &&
    typeof price.packageUnit === 'string' &&
    Object.keys(unitLabels).includes(price.packageUnit) &&
    (price.packageUnit !== 'PIECE' || Number.isInteger(price.packageQuantity)) &&
    typeof price.priceCents === 'number' &&
    Number.isSafeInteger(price.priceCents) &&
    price.priceCents >= 0 &&
    price.priceCents <= 1_000_000_000 &&
    price.currency === 'EUR' &&
    isPriceDate(price.priceDate) &&
    (price.source === 'MANUAL' || price.source === 'OPEN_PRICES') &&
    (price.priceId === null ||
      (typeof price.priceId === 'number' &&
        Number.isSafeInteger(price.priceId) &&
        price.priceId > 0)) &&
    (price.productId === null ||
      (typeof price.productId === 'number' &&
        Number.isSafeInteger(price.productId) &&
        price.productId > 0))
  )
}

export function parseEuroCents(value: string): number | null {
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(value.trim())) return null

  const [whole = '0', fraction = ''] = value.trim().replace(',', '.').split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))

  return Number.isSafeInteger(cents) ? cents : null
}

function finiteCost(value: number): number | null {
  return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null
}

export function calculateCosts(
  items: readonly RecipeIngredient[],
  prices: Readonly<Record<string, ProductPrice>>,
  pantry: Readonly<Record<string, string>> = {},
): IngredientCost[] {
  return items.map((item) => {
    const key = priceKey(item)
    const selected = prices[key]
    const amount = baseAmount(item.quantity, item.unit)
    const pack = selected ? baseAmount(selected.packageQuantity, selected.packageUnit) : null

    const price = selected && pack?.unit === amount.unit ? selected : null
    const inPantry = pantry[key] === amountSignature(item)
    const ratio = price && pack ? amount.quantity / pack.quantity : null

    let packages: number | null = null

    if (ratio !== null) {
      const nearest = Math.round(ratio)

      packages =
        nearest > 0 && Math.abs(ratio - nearest) <= Number.EPSILON * Math.max(1, ratio) * 8
          ? nearest
          : Math.ceil(ratio)

      if (!Number.isSafeInteger(packages)) packages = null
    }

    return {
      item,
      key,
      price,
      inPantry,
      consumptionCents: price && ratio !== null ? finiteCost(price.priceCents * ratio) : null,
      packages: inPantry ? 0 : packages,
      purchaseCents: inPantry
        ? 0
        : price && packages !== null
          ? finiteCost(price.priceCents * packages)
          : null,
    }
  })
}

export function formatMoney(cents: number | null): string {
  return cents === null ? '—' : moneyFormatter.format(cents / 100)
}

export function formatPackage(price: ProductPrice): string {
  const amount = baseAmount(price.packageQuantity, price.packageUnit)

  if (amount.quantity >= 1000 && (amount.unit === 'GRAM' || amount.unit === 'MILLILITER')) {
    amount.quantity /= 1000
    amount.unit = amount.unit === 'GRAM' ? 'KILOGRAM' : 'LITER'
  }

  return formatIngredientAmount({
    ingredient: { id: 0, name: '' },
    ...amount,
  })
}

export function formatPriceDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`))
}

export function isOldPrice(value: string): boolean {
  return Date.now() - Date.parse(`${value}T00:00:00Z`) > 90 * 86_400_000
}
