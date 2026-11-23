import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShoppingListDocument, ShoppingSnapshot } from '@/types/shoppingSync'
import type { ProductPrice } from '@/types/prices'
import { exampleRecipes } from '@/data/exampleRecipes'

vi.mock('@/auth/auth0', () => ({
  getApiToken: vi.fn<() => Promise<string>>().mockResolvedValue('test-token'),
}))

vi.mock('@/services/shoppingListService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/shoppingListService')>()),
  getShoppingList: vi.fn<() => Promise<ShoppingListDocument>>(),
  saveShoppingList: vi.fn<(document: ShoppingListDocument) => Promise<ShoppingListDocument>>(),
}))

const empty = (): ShoppingSnapshot => ({ selections: [], checkedKeys: [], prices: {}, pantry: {} })
const document = (version = 0, data = empty()): ShoppingListDocument => ({ version, data })
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const price: ProductPrice = {
  priceId: null,
  productId: null,
  productName: 'Mehl',
  packageQuantity: 1000,
  packageUnit: 'GRAM',
  priceCents: 119,
  currency: 'EUR',
  shop: 'Testmarkt',
  city: null,
  priceDate: '2025-01-01',
  source: 'MANUAL',
}

let account: typeof import('@/auth/accountScope')
let store: typeof import('@/stores/shoppingList')
let prices: typeof import('@/stores/prices')
let service: typeof import('@/services/shoppingListService')
let coordinator: typeof import('@/stores/shoppingSync')
let api: typeof import('@/services/apiClient')
let sync: ReturnType<typeof coordinator.startShoppingSync> | undefined

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.resetModules()
  localStorage.clear()
  account = await import('@/auth/accountScope')
  account.setActiveAccount('auth0|alice')
  store = await import('@/stores/shoppingList')
  prices = await import('@/stores/prices')
  service = await import('@/services/shoppingListService')
  coordinator = await import('@/stores/shoppingSync')
  api = await import('@/services/apiClient')
  vi.mocked(service.getShoppingList).mockReset().mockResolvedValue(document())
  vi.mocked(service.saveShoppingList)
    .mockReset()
    .mockImplementation(async (next) =>
      clone({ version: next.version === null ? 0 : next.version + 1, data: next.data }),
    )
})

afterEach(() => {
  sync?.stop()
  sync = undefined
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Synchronisierung der privaten Einkaufsliste', () => {
  it('übernimmt bisherige Browserdaten genau bei der ersten Serverspeicherung', async () => {
    store.setShoppingRecipe(exampleRecipes[0]!, 4)
    store.setShoppingItemChecked('1:GRAM:400', true)
    prices.setIngredientPrice(exampleRecipes[0]!.ingredients[0]!, price)
    vi.mocked(service.getShoppingList).mockResolvedValue({ version: null, data: empty() })
    sync = coordinator.startShoppingSync(0)
    await settle()

    expect(service.saveShoppingList).toHaveBeenCalledOnce()
    expect(vi.mocked(service.saveShoppingList).mock.calls[0]![0].data).toMatchObject({
      selections: [{ recipeId: 1, servings: 4 }],
      checkedKeys: ['1:GRAM:400'],
      prices: { '1:GRAM': price },
    })
    expect(sync.state.ready).toBe(true)
    expect(sync.state.error).toBe('')
  })

  it('stellt auf einem neuen Gerät Auswahl, Häkchen, Preise und Vorräte wieder her', async () => {
    const data: ShoppingSnapshot = {
      selections: [{ recipeId: 1, servings: 4 }],
      checkedKeys: ['1:GRAM:400'],
      prices: { '1:GRAM': price },
      pantry: { '1:GRAM': '1:GRAM:400' },
    }
    vi.mocked(service.getShoppingList).mockResolvedValue(document(7, data))
    sync = coordinator.startShoppingSync(0)
    await settle()

    expect(store.shoppingListState.selections).toEqual(data.selections)
    expect(store.shoppingListState.checkedKeys).toEqual(data.checkedKeys)
    expect(prices.priceState.prices).toEqual(data.prices)
    expect(prices.priceState.pantry).toEqual(data.pantry)
    expect(service.saveShoppingList).not.toHaveBeenCalled()
  })

  it('überschreibt einen vorhandenen Serverstand nicht mit einem alten Browsercache', async () => {
    store.setShoppingRecipe(exampleRecipes[0]!, 2)
    vi.mocked(service.getShoppingList).mockResolvedValue(document(3))
    sync = coordinator.startShoppingSync(0)
    await settle()
    expect(store.shoppingListState.selections).toEqual([])
    expect(service.saveShoppingList).not.toHaveBeenCalled()
  })

  it('speichert schnelle Änderungen zusammengefasst mit der zuletzt gelesenen Version', async () => {
    sync = coordinator.startShoppingSync(0)
    await settle()
    store.setShoppingRecipe(exampleRecipes[0]!, 2)
    store.setShoppingRecipe(exampleRecipes[0]!, 4)
    expect(sync.state.pending).toBe(true)
    await vi.advanceTimersByTimeAsync(350)
    expect(service.saveShoppingList).toHaveBeenCalledOnce()
    expect(vi.mocked(service.saveShoppingList).mock.calls[0]![0]).toMatchObject({
      version: 0,
      data: { selections: [{ recipeId: 1, servings: 4 }] },
    })
    expect(sync.state.pending).toBe(false)
  })

  it('liest bei Versionskonflikten neu und behält Änderungen beider Geräte', async () => {
    let remote = document()
    vi.mocked(service.getShoppingList).mockImplementation(async () => clone(remote))
    vi.mocked(service.saveShoppingList).mockImplementation(async (next) => {
      if (next.version !== remote.version) throw new api.ApiError('Konflikt', 409)
      remote = document(remote.version! + 1, clone(next.data))
      return clone(remote)
    })
    sync = coordinator.startShoppingSync(0)
    await settle()
    remote = document(1, { ...empty(), selections: [{ recipeId: 2, servings: 12 }] })
    store.setShoppingRecipe(exampleRecipes[0]!, 4)
    await vi.advanceTimersByTimeAsync(350)

    expect(remote.data.selections).toEqual([
      { recipeId: 1, servings: 4 },
      { recipeId: 2, servings: 12 },
    ])
    expect(store.shoppingListState.selections).toEqual(remote.data.selections)
    expect(service.saveShoppingList).toHaveBeenCalledTimes(2)
    expect(sync.state.error).toBe('')
  })

  it('verliert keine weiteren Änderungen, während eine Speicherung noch läuft', async () => {
    let finish: ((value: ShoppingListDocument) => void) | undefined
    vi.mocked(service.saveShoppingList).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    sync = coordinator.startShoppingSync(0)
    await settle()
    store.setShoppingItemChecked('1:GRAM:200', true)
    await vi.advanceTimersByTimeAsync(350)
    expect(sync.state.saving).toBe(true)
    const sent = clone(vi.mocked(service.saveShoppingList).mock.calls[0]![0])
    store.setShoppingItemChecked('2:PIECE:2', true)
    finish?.({ version: 1, data: sent.data })
    await settle()

    expect(store.shoppingListState.checkedKeys).toEqual(['1:GRAM:200', '2:PIECE:2'])
    expect(vi.mocked(service.saveShoppingList).mock.lastCall![0].data.checkedKeys).toEqual([
      '1:GRAM:200',
      '2:PIECE:2',
    ])
    expect(sync.state.pending).toBe(false)
  })

  it('behält bei Ladefehlern den lokalen Stand und synchronisiert nach einem neuen Versuch', async () => {
    store.setShoppingRecipe(exampleRecipes[0]!, 4)
    vi.mocked(service.getShoppingList).mockRejectedValueOnce(new Error('Offline'))
    sync = coordinator.startShoppingSync(0)
    await settle()
    expect(sync.state.ready).toBe(true)
    expect(sync.state.error).toContain('Noch nicht synchronisiert')
    expect(store.shoppingListState.selections).toHaveLength(1)

    vi.mocked(service.getShoppingList).mockResolvedValue({ version: null, data: empty() })
    await sync.retry()
    expect(service.saveShoppingList).toHaveBeenCalledOnce()
    expect(sync.state.error).toBe('')
  })

  it('behält fehlgeschlagene Schreibvorgänge im Cache und versucht sie erneut', async () => {
    sync = coordinator.startShoppingSync(0)
    await settle()
    vi.mocked(service.saveShoppingList).mockRejectedValueOnce(new Error('Offline'))
    store.setShoppingRecipe(exampleRecipes[0]!, 4)
    await vi.advanceTimersByTimeAsync(350)
    expect(sync.state.error).not.toBe('')
    expect(sync.state.pending).toBe(true)
    expect(localStorage.getItem('rezeptmanager.shopping-list.v1:auth0%7Calice')).toContain(
      '"servings":4',
    )
    await sync.retry()
    expect(sync.state.error).toBe('')
    expect(sync.state.pending).toBe(false)
  })

  it('verwirft eine verspätete Antwort nach einem Kontowechsel', async () => {
    let finish: ((value: ShoppingListDocument) => void) | undefined
    vi.mocked(service.getShoppingList).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    sync = coordinator.startShoppingSync(0)
    account.setActiveAccount('auth0|bob')
    await settle()
    finish?.(document(9, { ...empty(), selections: [{ recipeId: 1, servings: 8 }] }))
    await settle()
    expect(account.activeAccount.value).toBe('auth0|bob')
    expect(store.shoppingListState.selections).toEqual([])
    expect(service.saveShoppingList).not.toHaveBeenCalled()
  })

  it('überträgt ausstehende Änderungen nicht in ein anderes Konto', async () => {
    sync = coordinator.startShoppingSync(0)
    await settle()
    store.setShoppingRecipe(exampleRecipes[0]!, 4)
    account.setActiveAccount('auth0|bob')
    await settle()
    await vi.advanceTimersByTimeAsync(350)
    expect(store.shoppingListState.selections).toEqual([])
    expect(service.saveShoppingList).not.toHaveBeenCalled()
  })

  it('holt beim Zurückkehren zum Fenster den Stand des anderen Geräts', async () => {
    sync = coordinator.startShoppingSync(0)
    await settle()
    vi.mocked(service.getShoppingList).mockResolvedValue(
      document(2, {
        ...empty(),
        selections: [{ recipeId: 1, servings: 6 }],
      }),
    )
    window.dispatchEvent(new Event('focus'))
    await settle()
    expect(store.shoppingListState.selections).toEqual([{ recipeId: 1, servings: 6 }])
    expect(service.saveShoppingList).not.toHaveBeenCalled()
  })

  it('beendet die Überwachung beim Verlassen der Anwendung', async () => {
    sync = coordinator.startShoppingSync(0)
    await settle()
    sync.stop()
    window.dispatchEvent(new Event('focus'))
    store.setShoppingRecipe(exampleRecipes[0]!, 4)
    await vi.advanceTimersByTimeAsync(500)
    expect(service.getShoppingList).toHaveBeenCalledOnce()
    expect(service.saveShoppingList).not.toHaveBeenCalled()
  })
})
