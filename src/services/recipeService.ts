import type { Recipe, RecipeRequest } from '@/types/recipe'
import { requestApi } from '@/services/apiClient'

export function getRecipes(): Promise<Recipe[]> {
  return requestApi('/api/recipes', {
    errorMessage: 'Die Rezeptabfrage ist fehlgeschlagen',
  })
}

export function getRecipe(id: number, signal?: AbortSignal): Promise<Recipe | null> {
  return requestApi(`/api/recipes/${id}`, {
    signal,
    allowNotFound: true,
    errorMessage: 'Die Rezeptabfrage ist fehlgeschlagen',
  })
}

export function createRecipe(request: RecipeRequest): Promise<Recipe> {
  return requestApi('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    errorMessage: 'Das Speichern ist fehlgeschlagen',
  })
}

export function updateRecipe(id: number, request: RecipeRequest): Promise<Recipe> {
  return requestApi(`/api/recipes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    errorMessage: 'Das Aktualisieren ist fehlgeschlagen',
  })
}

export function deleteRecipe(id: number): Promise<void> {
  return requestApi(`/api/recipes/${id}`, {
    method: 'DELETE',
    errorMessage: 'Das Löschen ist fehlgeschlagen',
  })
}
