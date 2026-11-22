import type { Recipe, RecipeRequest } from '@/types/recipe'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '')

function getRecipesUrl(): string {
  if (!apiBaseUrl) {
    throw new Error('Die Backend-Adresse ist nicht konfiguriert.')
  }

  return `${apiBaseUrl}/api/recipes`
}

export async function getRecipes(): Promise<Recipe[]> {
  const response = await fetch(getRecipesUrl(), {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Die Rezeptabfrage ist fehlgeschlagen: HTTP ${response.status}`)
  }

  return (await response.json()) as Recipe[]
}

export async function getRecipe(id: number, signal?: AbortSignal): Promise<Recipe | null> {
  const response = await fetch(`${getRecipesUrl()}/${id}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (response.status === 404) return null

  if (!response.ok) {
    throw new Error(`Die Rezeptabfrage ist fehlgeschlagen: HTTP ${response.status}`)
  }

  return (await response.json()) as Recipe
}

export async function createRecipe(request: RecipeRequest): Promise<Recipe> {
  const response = await fetch(getRecipesUrl(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Das Speichern ist fehlgeschlagen: HTTP ${response.status}`)
  }

  return (await response.json()) as Recipe
}

export async function updateRecipe(id: number, request: RecipeRequest): Promise<Recipe> {
  const response = await fetch(`${getRecipesUrl()}/${id}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Das Aktualisieren ist fehlgeschlagen: HTTP ${response.status}`)
  }

  return (await response.json()) as Recipe
}

export async function deleteRecipe(id: number): Promise<void> {
  const response = await fetch(`${getRecipesUrl()}/${id}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Das Löschen ist fehlgeschlagen: HTTP ${response.status}`)
  }
}
