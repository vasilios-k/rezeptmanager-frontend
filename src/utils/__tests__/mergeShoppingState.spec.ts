import { describe, expect, it } from 'vitest'
import { emptyShoppingSnapshot, mergeShoppingState } from '@/utils/mergeShoppingState'
import type { ShoppingSnapshot } from '@/types/shoppingSync'

function state(overrides: Partial<ShoppingSnapshot> = {}): ShoppingSnapshot {
  return { ...emptyShoppingSnapshot(), ...overrides }
}

describe('Geräteübergreifende Änderungen zusammenführen', () => {
  it('behält eine auf einem anderen Gerät hinzugefügte Rezeptauswahl', () => {
    const result = mergeShoppingState(
      state(),
      state({ selections: [{ recipeId: 1, servings: 2 }] }),
      state({ selections: [{ recipeId: 2, servings: 12 }] }),
    )
    expect(result.selections).toEqual([
      { recipeId: 1, servings: 2 },
      { recipeId: 2, servings: 12 },
    ])
  })

  it('entfernt lokal abgewählte Rezepte, ohne andere neue Auswahlen zu verlieren', () => {
    const first = { recipeId: 1, servings: 2 }
    const other = { recipeId: 2, servings: 12 }
    expect(
      mergeShoppingState(
        state({ selections: [first] }),
        state(),
        state({ selections: [first, other] }),
      ).selections,
    ).toEqual([other])
  })

  it('führt unabhängig abgehakte Zutaten zusammen und berücksichtigt das Entfernen eines Häkchens', () => {
    const base = state({ checkedKeys: ['old'] })
    const local = state({ checkedKeys: ['local'] })
    const remote = state({ checkedKeys: ['old', 'remote'] })
    expect(mergeShoppingState(base, local, remote).checkedKeys).toEqual(['local', 'remote'])
  })

  it('setzt Häkchen zurück, wenn durch das Zusammenführen neue Gesamtmengen entstehen', () => {
    const local = state({ selections: [{ recipeId: 1, servings: 2 }], checkedKeys: ['local'] })
    const remote = state({ selections: [{ recipeId: 2, servings: 12 }], checkedKeys: ['remote'] })
    expect(mergeShoppingState(state(), local, remote).checkedKeys).toEqual([])
  })

  it('übernimmt remote geänderte Portionen und ignoriert Häkchen für alte Mengen', () => {
    const base = state({ selections: [{ recipeId: 1, servings: 2 }] })
    const local = state({ ...base, checkedKeys: ['old-amount'] })
    const remote = state({
      selections: [{ recipeId: 1, servings: 4 }],
      checkedKeys: ['new-amount'],
    })
    expect(mergeShoppingState(base, local, remote).checkedKeys).toEqual(['new-amount'])
  })

  it('wendet bei derselben Rezeptauswahl die noch ausstehende lokale Änderung an', () => {
    const base = state({ selections: [{ recipeId: 1, servings: 2 }] })
    const local = state({ selections: [{ recipeId: 1, servings: 6 }] })
    const remote = state({ selections: [{ recipeId: 1, servings: 4 }] })
    expect(mergeShoppingState(base, local, remote).selections).toEqual(local.selections)
  })

  it('führt Vorratsmarkierungen pro Zutat zusammen, ohne die Eingaben zu verändern', () => {
    const base = state({ pantry: { '1:GRAM': '1:GRAM:200' } })
    const local = state({ pantry: { '2:PIECE': '2:PIECE:2' } })
    const remote = state({ pantry: { '1:GRAM': '1:GRAM:200', '3:MILLILITER': '3:MILLILITER:300' } })
    const result = mergeShoppingState(base, local, remote)
    expect(result.pantry).toEqual({ '2:PIECE': '2:PIECE:2', '3:MILLILITER': '3:MILLILITER:300' })
    expect(base.pantry).toEqual({ '1:GRAM': '1:GRAM:200' })
  })
})
