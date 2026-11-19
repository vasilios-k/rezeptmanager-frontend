import type { RecipeIngredient, Unit } from '@/types/recipe'

export const unitLabels: Record<Unit, string> = {
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
  maximumFractionDigits: 3,
})

export function formatIngredientAmount(item: RecipeIngredient): string {
  const quantityLabel =
    item.quantity > 0 && item.quantity < 0.001 ? '< 0,001' : quantityFormatter.format(item.quantity)

  const unitLabel =
    item.unit === 'PINCH' && quantityLabel !== '1' ? 'Prisen' : unitLabels[item.unit]

  return `${quantityLabel} ${unitLabel}`
}
