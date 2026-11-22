import type { RecipeIngredient, Unit } from '@/types/recipe'

export interface ProductPrice {
  priceId: number | null
  productId: number | null
  productName: string
  packageQuantity: number
  packageUnit: Unit
  priceCents: number
  currency: 'EUR'
  shop: string
  city: string | null
  priceDate: string
  source: 'OPEN_PRICES' | 'MANUAL'
}

export interface PriceSearchResult {
  offers: ProductPrice[]
  page: number
  hasMore: boolean
}

export interface IngredientCost {
  item: RecipeIngredient
  key: string
  price: ProductPrice | null
  consumptionCents: number | null
  packages: number | null
  purchaseCents: number | null
  inPantry: boolean
}

export interface PriceState {
  prices: Record<string, ProductPrice>
  pantry: Record<string, string>
}
