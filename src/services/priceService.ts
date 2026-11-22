import type { Unit } from '@/types/recipe'
import type { PriceSearchResult } from '@/types/prices'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '')

export async function searchPrices(
  query: string,
  unit: Unit,
  page = 1,
  signal?: AbortSignal,
): Promise<PriceSearchResult> {
  if (!apiBaseUrl) {
    throw new Error('Die Backend-Adresse ist nicht konfiguriert.')
  }

  const parameters = new URLSearchParams({
    query: query.trim(),
    unit,
    page: String(page),
  })

  const response = await fetch(`${apiBaseUrl}/api/prices?${parameters}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new Error(
      'Der Preisdienst ist gerade nicht erreichbar. Du kannst einen eigenen Preis eingeben.',
    )
  }

  return (await response.json()) as PriceSearchResult
}
