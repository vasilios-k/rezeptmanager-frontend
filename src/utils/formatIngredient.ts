import type { RecipeIngredient, Unit } from '@/types/recipe'

const unitLabels: Record<Unit, string> = {
  GRAM: 'g',
  KILOGRAM: 'kg',
  MILLILITER: 'ml',
  LITER: 'l',
  TEASPOON: 'TL',
  TABLESPOON: 'EL',
  PIECE: 'Stk.',
  PINCH: 'Prise',
}

const quantityFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 20,
})

export function formatIngredientAmount(item: RecipeIngredient): string {
  const unitLabel = item.unit === 'PINCH' && item.quantity !== 1 ? 'Prisen' : unitLabels[item.unit]

  return `${quantityFormatter.format(item.quantity)} ${unitLabel}`
}
