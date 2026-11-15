import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Recipe, RecipeRequest } from '@/types/recipe'

const fetchMock = vi.fn<typeof fetch>()

const request: RecipeRequest = {
  title: 'Testbrot',
  ingredients: [
    {
      ingredientName: 'Mehl',
      quantity: 250.5,
      unit: 'GRAM',
    },
  ],
  instructions: 'Zutaten vermischen.',
  prepTimeMinutes: 15,
  servings: 2,
}

const savedRecipe: Recipe = {
  id: 42,
  ...request,
  ingredients: [
    {
      ingredient: {
        id: 1,
        name: 'Mehl',
      },
      quantity: 250.5,
      unit: 'GRAM',
    },
  ],
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

beforeEach(() => {
  vi.resetModules()
  fetchMock.mockReset()
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/')
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('recipeService', () => {
  it('lädt die Rezeptliste über GET', async () => {
    fetchMock.mockResolvedValue(jsonResponse([savedRecipe]))

    const { getRecipes } = await import('@/services/recipeService')
    const result = await getRecipes()

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/recipes', {
      headers: {
        Accept: 'application/json',
      },
    })
    expect(result).toEqual([savedRecipe])
  })

  it('legt ein Rezept über POST an', async () => {
    fetchMock.mockResolvedValue(jsonResponse(savedRecipe, 201))

    const { createRecipe } = await import('@/services/recipeService')
    const result = await createRecipe(request)

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/recipes', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    expect(result).toEqual(savedRecipe)
  })

  it('aktualisiert ein Rezept über PUT mit seiner ID', async () => {
    fetchMock.mockResolvedValue(jsonResponse(savedRecipe))

    const { updateRecipe } = await import('@/services/recipeService')
    const result = await updateRecipe(42, request)

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/recipes/42', {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    expect(result).toEqual(savedRecipe)
  })

  it('meldet eine vom Backend abgelehnte Aktualisierung als Fehler', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          message: 'Ungültige Eingaben',
        },
        400,
      ),
    )

    const { updateRecipe } = await import('@/services/recipeService')

    await expect(updateRecipe(42, request)).rejects.toThrow(
      'Das Aktualisieren ist fehlgeschlagen: HTTP 400',
    )
  })
})
