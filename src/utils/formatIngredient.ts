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
// übernimmt deutsche Zahlenformatierung aus 0.5 wird 0,5
const quantityFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 20,
})
// wenn es mehr als 1 prise ist wird der text prisen ausgegeben
export function formatIngredientAmount(item: RecipeIngredient): string {
  const unitLabel = item.unit === 'PINCH' && item.quantity !== 1 ? 'Prisen' : unitLabels[item.unit]

  return `${quantityFormatter.format(item.quantity)} ${unitLabel}`
}
