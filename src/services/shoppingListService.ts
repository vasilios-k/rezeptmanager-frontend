import { requestApi } from '@/services/apiClient'
import type { ShoppingListDocument } from '@/types/shoppingSync'
import { isProductPrice, baseAmount } from '@/utils/recipeCosts'
import { isValidServings } from '@/utils/scaleRecipe'

const validKey = /^[1-9]\d*:(GRAM|MILLILITER|PIECE|TEASPOON|TABLESPOON|PINCH)$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isShoppingListDocument(value: unknown): value is ShoppingListDocument {
  if (!isRecord(value) || !isRecord(value.data)) return false
  if (
    value.version !== null &&
    !(
      typeof value.version === 'number' &&
      Number.isSafeInteger(value.version) &&
      value.version >= 0
    )
  )
    return false

  const { selections, checkedKeys, prices, pantry } = value.data
  return (
    Array.isArray(selections) &&
    selections.length <= 1000 &&
    selections.every(
      (item: unknown) =>
        isRecord(item) &&
        typeof item.recipeId === 'number' &&
        Number.isSafeInteger(item.recipeId) &&
        item.recipeId > 0 &&
        isValidServings(item.servings),
    ) &&
    Array.isArray(checkedKeys) &&
    checkedKeys.length <= 2000 &&
    checkedKeys.every((key: unknown) => typeof key === 'string' && key.length <= 180) &&
    isRecord(prices) &&
    Object.keys(prices).length <= 2000 &&
    Object.entries(prices).every(
      ([key, price]) =>
        validKey.test(key) &&
        isProductPrice(price) &&
        key.endsWith(`:${baseAmount(price.packageQuantity, price.packageUnit).unit}`),
    ) &&
    isRecord(pantry) &&
    Object.keys(pantry).length <= 2000 &&
    Object.entries(pantry).every(
      ([key, signature]) =>
        validKey.test(key) &&
        typeof signature === 'string' &&
        signature.length <= 180 &&
        signature.startsWith(`${key}:`),
    )
  )
}

function checked(value: unknown): ShoppingListDocument {
  if (!isShoppingListDocument(value))
    throw new Error('Die gespeicherte Einkaufsliste ist ungültig.')
  return value
}

export async function getShoppingList(): Promise<ShoppingListDocument> {
  return checked(await requestApi('/api/shopping-list'))
}

export async function saveShoppingList(
  document: ShoppingListDocument,
): Promise<ShoppingListDocument> {
  return checked(
    await requestApi('/api/shopping-list', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(document),
    }),
  )
}
