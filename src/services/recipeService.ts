import type { Recipe } from '@/types/recipe'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '')

export async function getRecipes(): Promise<Recipe[]> {
  if (!apiBaseUrl) {
    throw new Error('Die Backend-Adresse ist nicht konfiguriert.')
  }

  const response = await fetch(`${apiBaseUrl}/api/recipes`, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Die Rezeptabfrage ist fehlgeschlagen: HTTP ${response.status}`)
  }

  return (await response.json()) as Recipe[]
}
