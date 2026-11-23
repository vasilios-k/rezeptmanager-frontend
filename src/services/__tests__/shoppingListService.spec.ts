import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestApi } from '@/services/apiClient'
import {
  getShoppingList,
  isShoppingListDocument,
  saveShoppingList,
} from '@/services/shoppingListService'
import type { ShoppingListDocument } from '@/types/shoppingSync'

vi.mock('@/services/apiClient', () => ({ requestApi: vi.fn<typeof requestApi>() }))

const document: ShoppingListDocument = {
  version: 3,
  data: { selections: [{ recipeId: 1, servings: 4 }], checkedKeys: [], prices: {}, pantry: {} },
}

beforeEach(() => {
  vi.mocked(requestApi).mockReset().mockResolvedValue(document)
})

describe('Shopping list API', () => {
  it('lädt die private Einkaufsliste über den authentifizierten API-Client', async () => {
    expect(await getShoppingList()).toEqual(document)
    expect(requestApi).toHaveBeenCalledWith('/api/shopping-list')
  })

  it('sendet Auswahl und Versionsnummer gemeinsam als JSON', async () => {
    expect(await saveShoppingList(document)).toEqual(document)
    expect(requestApi).toHaveBeenCalledWith('/api/shopping-list', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(document),
    })
  })

  it('akzeptiert den noch nicht angelegten leeren Serverstand', () => {
    expect(isShoppingListDocument({ ...document, version: null })).toBe(true)
  })

  it('weist fehlerhafte Antworten und beschädigte gespeicherte Ausgangsstände zurück', async () => {
    for (const invalid of [
      null,
      {},
      { ...document, version: -1 },
      { ...document, data: { ...document.data, selections: [{ recipeId: 1, servings: 0 }] } },
      { ...document, data: { ...document.data, prices: [] } },
      { ...document, data: { ...document.data, pantry: { '1:GRAM': '2:GRAM:400' } } },
    ]) {
      expect(isShoppingListDocument(invalid)).toBe(false)
      vi.mocked(requestApi).mockResolvedValueOnce(invalid)
      await expect(getShoppingList()).rejects.toThrow('ungültig')
    }
  })
})
