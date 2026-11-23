import type { Unit } from '@/types/recipe'
import type { PriceSearchResult } from '@/types/prices'
import { requestApi } from '@/services/apiClient'

export function searchPrices(
  query: string,
  unit: Unit,
  page = 1,
  signal?: AbortSignal,
): Promise<PriceSearchResult> {
  const parameters = new URLSearchParams({
    query: query.trim(),
    unit,
    page: String(page),
  })

  return requestApi(`/api/prices?${parameters}`, {
    signal,
    errorMessage:
      'Der Preisdienst ist gerade nicht erreichbar. Du kannst einen eigenen Preis eingeben.',
  })
}
