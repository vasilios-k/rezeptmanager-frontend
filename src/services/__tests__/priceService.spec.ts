import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { searchPrices } from '@/services/priceService'

vi.hoisted(() => vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/'))

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe('priceService', () => {
  it('ruft das eigene Backend auf und überträgt Suchbegriffe, Einheiten und Abbruchsignal', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ offers: [], page: 2, hasMore: false }), { status: 200 }),
    )

    const controller = new AbortController()

    await searchPrices(' Mehl & Zucker ', 'GRAM', 2, controller.signal)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/prices?query=Mehl+%26+Zucker&unit=GRAM&page=2',
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    )
  })

  it('meldet Ausfälle als Fehler statt als kostenlose Zutaten', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }))

    await expect(searchPrices('Mehl', 'GRAM')).rejects.toThrow('eigenen Preis')
  })
})
