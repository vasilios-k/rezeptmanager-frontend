import type { ShoppingSnapshot } from '@/types/shoppingSync'

export function emptyShoppingSnapshot(): ShoppingSnapshot {
  return { selections: [], checkedKeys: [], prices: {}, pantry: {} }
}

function ordered<T>(values: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)))
}

export function copyShoppingSnapshot(data: ShoppingSnapshot): ShoppingSnapshot {
  const copy = JSON.parse(JSON.stringify(data)) as ShoppingSnapshot
  return {
    selections: copy.selections.sort((a, b) => a.recipeId - b.recipeId),
    checkedKeys: [...new Set(copy.checkedKeys)].sort(),
    prices: ordered(copy.prices),
    pantry: ordered(copy.pantry),
  }
}

export function sameShoppingValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function mergeEntries<T>(
  base: Record<string, T>,
  local: Record<string, T>,
  remote: Record<string, T>,
): Record<string, T> {
  const result = { ...remote }
  for (const key of new Set([...Object.keys(base), ...Object.keys(local)])) {
    if (sameShoppingValue(base[key], local[key])) continue
    if (Object.prototype.hasOwnProperty.call(local, key)) result[key] = local[key]!
    else delete result[key]
  }
  return result
}

function selectionMap(data: ShoppingSnapshot) {
  return Object.fromEntries(data.selections.map((item) => [item.recipeId, item]))
}

function checkedMap(data: ShoppingSnapshot): Record<string, boolean> {
  return Object.fromEntries(data.checkedKeys.map((key) => [key, true]))
}

// Nur tatsächlich lokal geänderte Einträge werden auf den aktuellen Serverstand angewendet.
export function mergeShoppingState(
  previous: ShoppingSnapshot,
  current: ShoppingSnapshot,
  incoming: ShoppingSnapshot,
): ShoppingSnapshot {
  const base = copyShoppingSnapshot(previous)
  const local = copyShoppingSnapshot(current)
  const remote = copyShoppingSnapshot(incoming)
  const selections = Object.values(
    mergeEntries(selectionMap(base), selectionMap(local), selectionMap(remote)),
  ).sort((a, b) => a.recipeId - b.recipeId)

  let checkedKeys: string[]
  const localSelectionChanged = !sameShoppingValue(base.selections, local.selections)
  const remoteSelectionChanged = !sameShoppingValue(base.selections, remote.selections)

  if (localSelectionChanged || remoteSelectionChanged) {
    // Häkchen gelten nur für die Zutatenmengen genau dieser Rezeptauswahl.
    if (localSelectionChanged && sameShoppingValue(selections, local.selections)) {
      checkedKeys = local.checkedKeys
    } else if (remoteSelectionChanged && sameShoppingValue(selections, remote.selections)) {
      checkedKeys = remote.checkedKeys
    } else checkedKeys = []
  } else {
    checkedKeys = Object.keys(mergeEntries(checkedMap(base), checkedMap(local), checkedMap(remote)))
  }

  return copyShoppingSnapshot({
    selections,
    checkedKeys,
    prices: mergeEntries(base.prices, local.prices, remote.prices),
    pantry: mergeEntries(base.pantry, local.pantry, remote.pantry),
  })
}
