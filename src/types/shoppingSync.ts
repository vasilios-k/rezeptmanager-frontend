import type { PriceState } from '@/types/prices'
import type { ShoppingListState } from '@/types/shoppingList'

export type ShoppingSnapshot = ShoppingListState & PriceState

export interface ShoppingListDocument {
  version: number | null
  data: ShoppingSnapshot
}
