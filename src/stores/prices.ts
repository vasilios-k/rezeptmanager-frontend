import { reactive, readonly, watch } from 'vue'
import { activeAccount, readAccountStorage, writeAccountStorage } from '@/auth/accountScope'
import type { RecipeIngredient } from '@/types/recipe'
import type { PriceState, ProductPrice } from '@/types/prices'
import { amountSignature, baseAmount, isProductPrice, priceKey } from '@/utils/recipeCosts'

const storageKey = 'rezeptmanager.prices.v1'
const validKey = /^[1-9]\d*:(GRAM|MILLILITER|PIECE|TEASPOON|TABLESPOON|PINCH)$/

function loadState(): PriceState {
  const empty: PriceState = { prices: {}, pantry: {} }

  try {
    const saved: unknown = JSON.parse(readAccountStorage(storageKey) ?? 'null')

    if (typeof saved !== 'object' || saved === null) return empty

    const data = saved as { prices?: unknown; pantry?: unknown }

    if (typeof data.prices === 'object' && data.prices !== null) {
      for (const [key, price] of Object.entries(data.prices)) {
        if (
          validKey.test(key) &&
          isProductPrice(price) &&
          key.endsWith(`:${baseAmount(price.packageQuantity, price.packageUnit).unit}`)
        ) {
          empty.prices[key] = price
        }
      }
    }

    if (typeof data.pantry === 'object' && data.pantry !== null) {
      for (const [key, value] of Object.entries(data.pantry)) {
        if (validKey.test(key) && typeof value === 'string' && value.startsWith(`${key}:`)) {
          empty.pantry[key] = value
        }
      }
    }
  } catch {
    // Ungültige oder gesperrte Browserdaten verhindern die Bedienung nicht.
  }

  return empty
}

const state = reactive(loadState())
export const priceState = readonly(state)

watch(
  activeAccount,
  () => {
    const next = loadState()
    state.prices = next.prices
    state.pantry = next.pantry
  },
  { flush: 'sync' },
)

function saveState(): void {
  try {
    writeAccountStorage(storageKey, JSON.stringify(state))
  } catch {
    // Die Auswahl bleibt für diese Sitzung verfügbar.
  }
}

export function replacePriceState(next: PriceState): void {
  if (!activeAccount.value) return
  state.prices = Object.fromEntries(
    Object.entries(next.prices).map(([key, price]) => [key, { ...price }]),
  )
  state.pantry = { ...next.pantry }
  saveState()
}

export function setIngredientPrice(item: RecipeIngredient, price: ProductPrice): void {
  if (!activeAccount.value) return
  if (
    !isProductPrice(price) ||
    baseAmount(item.quantity, item.unit).unit !==
      baseAmount(price.packageQuantity, price.packageUnit).unit
  ) {
    throw new RangeError('Preis und Zutatenmenge müssen zusammenpassen.')
  }

  state.prices[priceKey(item)] = { ...price }
  saveState()
}

export function removeIngredientPrice(item: RecipeIngredient): void {
  if (!activeAccount.value) return
  delete state.prices[priceKey(item)]
  saveState()
}

export function setIngredientInPantry(item: RecipeIngredient, checked: boolean): void {
  if (!activeAccount.value) return
  const key = priceKey(item)

  if (checked) state.pantry[key] = amountSignature(item)
  else delete state.pantry[key]

  saveState()
}
