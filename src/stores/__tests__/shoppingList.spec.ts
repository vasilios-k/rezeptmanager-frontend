import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exampleRecipes } from '@/data/exampleRecipes'

const storageKey = 'rezeptmanager.shopping-list.v1:auth0%7Ctest-user'
const recipe = exampleRecipes.find((item) => item.id === 1)!

beforeEach(async () => {
  vi.resetModules()
  const { setActiveAccount } = await import('@/auth/accountScope')
  setActiveAccount('auth0|test-user')
  localStorage.clear()
})

afterEach(() => vi.restoreAllMocks())

describe('shopping list storage', () => {
  it('speichert nur IDs und Portionen und aktualisiert eine Auswahl ohne Duplikat', async () => {
    const store = await import('@/stores/shoppingList')
    store.setShoppingRecipe(recipe, 2)
    store.setShoppingRecipe(recipe, 4)

    expect(store.shoppingListState.selections).toEqual([{ recipeId: 1, servings: 4 }])
    expect(JSON.parse(localStorage.getItem(storageKey) ?? 'null')).toEqual({
      selections: [{ recipeId: 1, servings: 4 }],
      checkedKeys: [],
    })
  })

  it('stellt Auswahl und Häkchen beim erneuten Laden wieder her', async () => {
    const store = await import('@/stores/shoppingList')
    store.setShoppingRecipe(recipe, 4)
    store.setShoppingItemChecked('1:GRAM:400', true)

    vi.resetModules()
    const { setActiveAccount } = await import('@/auth/accountScope')
    setActiveAccount('auth0|test-user')
    const restored = await import('@/stores/shoppingList')

    expect(restored.shoppingListState.selections).toEqual([{ recipeId: 1, servings: 4 }])
    expect(restored.shoppingListState.checkedKeys).toEqual(['1:GRAM:400'])
  })

  it('beachtet Mindestportionen und setzt bei einer Änderung die Häkchen zurück', async () => {
    const store = await import('@/stores/shoppingList')
    store.setShoppingRecipe(recipe, 1)
    store.setShoppingItemChecked('1:GRAM:200', true)
    store.setShoppingRecipe(recipe, 2)

    expect(store.shoppingListState.checkedKeys).toHaveLength(1)

    store.setShoppingRecipe(recipe, 4)
    expect(store.shoppingListState.checkedKeys).toEqual([])

    store.setShoppingRecipe(recipe, 1.5)
    expect(store.shoppingListState.selections[0]?.servings).toBe(4)

    store.removeShoppingRecipe(1)
    expect(store.shoppingListState.selections).toEqual([])
  })

  it('entfernt gelöschte Rezepte und berücksichtigt erhöhte Originalportionen', async () => {
    const store = await import('@/stores/shoppingList')

    for (const item of exampleRecipes) {
      store.setShoppingRecipe(item, item.servings)
    }

    expect(store.syncShoppingRecipes([{ ...recipe, servings: 6 }])).toBe(1)
    expect(store.shoppingListState.selections).toEqual([{ recipeId: 1, servings: 6 }])
  })

  it('entfernt veraltete Häkchen nach einer Mengenänderung im Backend', async () => {
    const store = await import('@/stores/shoppingList')
    store.setShoppingItemChecked('1:GRAM:200', true)
    store.setShoppingItemChecked('2:PIECE:2', true)
    store.pruneShoppingChecks(['1:GRAM:400', '2:PIECE:2'])

    expect(store.shoppingListState.checkedKeys).toEqual(['2:PIECE:2'])

    store.setShoppingItemChecked('2:PIECE:2', false)
    expect(store.shoppingListState.checkedKeys).toEqual([])
  })

  it('ignoriert beschädigte gespeicherte Daten', async () => {
    localStorage.setItem(storageKey, '{kaputt')
    const store = await import('@/stores/shoppingList')

    expect(store.shoppingListState).toEqual({ selections: [], checkedKeys: [] })
  })

  it('filtert ungültige Einträge und doppelte IDs aus gespeicherten Daten', async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        selections: [
          null,
          { recipeId: -1, servings: 2 },
          { recipeId: 1, servings: 2 },
          { recipeId: 1, servings: 4 },
          { recipeId: 2, servings: '4' },
        ],
        checkedKeys: [1, '1:GRAM:400', '1:GRAM:400'],
      }),
    )
    const store = await import('@/stores/shoppingList')

    expect(store.shoppingListState).toEqual({
      selections: [{ recipeId: 1, servings: 4 }],
      checkedKeys: ['1:GRAM:400'],
    })
  })

  it('bleibt bei nicht verfügbarem Browserspeicher bedienbar', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Gesperrt')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Gesperrt')
    })
    const store = await import('@/stores/shoppingList')

    expect(() => store.setShoppingRecipe(recipe, 2)).not.toThrow()
    expect(store.shoppingListState.selections).toEqual([{ recipeId: 1, servings: 2 }])
  })
})
