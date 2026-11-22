import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import RecipeDetailView from '@/views/RecipeDetailView.vue'
import RecipeList from '@/components/RecipeList.vue'
import type { Recipe } from '@/types/recipe'

vi.hoisted(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
})

const fetchMock = vi.fn<typeof fetch>()

const recipe: Recipe = {
  id: 1,
  title: 'Pfannkuchen',
  ingredients: [
    { ingredient: { id: 1, name: 'Mehl' }, quantity: 200, unit: 'GRAM' },
    { ingredient: { id: 2, name: 'Eier' }, quantity: 2, unit: 'PIECE' },
  ],
  instructions: 'Zutaten verrühren.\n\nDen Teig ruhen lassen.\r\nPortionsweise ausbacken.',
  prepTimeMinutes: 25,
  servings: 2,
}

let mountedWrapper: VueWrapper | undefined

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function mountPage(path = '/recipes/1') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        name: 'recipes',
        component: RecipeList,
        props: { recipes: [recipe] },
      },
      {
        path: '/recipes/:id',
        name: 'recipe-detail',
        component: RecipeDetailView,
        props: true,
      },
    ],
  })

  await router.push(path)
  await router.isReady()

  const wrapper = mount(RouterView, {
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: { RouterLink: false },
    },
  })

  mountedWrapper = wrapper

  return { wrapper, router }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  mountedWrapper?.unmount()
  mountedWrapper = undefined

  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

afterAll(() => vi.unstubAllEnvs())

describe('RecipeDetailView', () => {
  it('lädt ein einzelnes Rezept über GET und zeigt nummerierte Schritte', async () => {
    fetchMock.mockResolvedValue(jsonResponse(recipe))

    const { wrapper } = await mountPage()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/recipes/1', {
      headers: { Accept: 'application/json' },
      signal: expect.any(AbortSignal),
    })

    expect(wrapper.get('h1').text()).toBe('Pfannkuchen')

    expect(wrapper.findAll('.instruction-steps li').map((step) => step.text())).toEqual([
      'Zutaten verrühren.',
      'Den Teig ruhen lassen.',
      'Portionsweise ausbacken.',
    ])

    expect(document.activeElement).toBe(wrapper.get('h1').element)
  })

  it('öffnet die Detailseite beim Klick auf den Rezeptnamen', async () => {
    fetchMock.mockResolvedValue(jsonResponse(recipe))

    const { wrapper, router } = await mountPage('/')

    await wrapper.get('.recipe-card h2 a').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/recipes/1')
    expect(wrapper.get('h1').text()).toBe('Pfannkuchen')
  })

  it('erlaubt das Abhaken und erneute Abwählen einzelner Zutaten', async () => {
    fetchMock.mockResolvedValue(jsonResponse(recipe))

    const { wrapper } = await mountPage()
    await flushPromises()

    await wrapper.get('input[type="checkbox"]').setValue(true)

    expect(wrapper.get('.checklist-status').text()).toBe('1 von 2 Zutaten abgehakt')
    expect(wrapper.get('input[type="checkbox"]').element).toHaveProperty('checked', true)

    await wrapper.get('input[type="checkbox"]').setValue(false)

    expect(wrapper.get('input[type="checkbox"]').element).toHaveProperty('checked', false)
    expect(wrapper.get('.checklist-status').text()).toBe('0 von 2 Zutaten abgehakt')
  })

  it('passt die Mengen an und setzt die Häkchen bei Portionsänderungen zurück', async () => {
    fetchMock.mockResolvedValue(jsonResponse(recipe))

    const { wrapper, router } = await mountPage()
    await flushPromises()

    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('.servings-trigger').trigger('click')
    await wrapper.get('.servings-input').setValue('4')
    await flushPromises()

    expect(wrapper.get('.ingredient-checklist').text()).toContain('400 g')
    expect(wrapper.get('.checklist-status').text()).toBe('0 von 2 Zutaten abgehakt')
    expect(router.currentRoute.value.query.servings).toBe('4')

    await wrapper.get('.servings-input').setValue('1')
    await wrapper.get('.servings-input').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.get('.servings-trigger').text()).toBe('2 Portionen')
    expect(wrapper.get('.ingredient-checklist').text()).toContain('200 g')
  })

  it('übernimmt die Portionszahl aus einem direkten Link', async () => {
    fetchMock.mockResolvedValue(jsonResponse(recipe))

    const { wrapper } = await mountPage('/recipes/1?servings=4')
    await flushPromises()

    expect(wrapper.get('.servings-trigger').text()).toBe('4 Portionen')
    expect(wrapper.get('.ingredient-checklist').text()).toContain('400 g')
  })

  it('stellt mit Escape auch die vorherige Portionszahl im Link wieder her', async () => {
    fetchMock.mockResolvedValue(jsonResponse(recipe))

    const { wrapper, router } = await mountPage('/recipes/1?servings=4')
    await flushPromises()

    await wrapper.get('.servings-trigger').trigger('click')
    await wrapper.get('.servings-input').setValue('6')
    await flushPromises()

    expect(router.currentRoute.value.query.servings).toBe('6')

    await wrapper.get('.servings-input').trigger('keydown', { key: 'Escape' })
    await flushPromises()

    expect(router.currentRoute.value.query.servings).toBe('4')
    expect(wrapper.get('.servings-trigger').text()).toBe('4 Portionen')
    expect(wrapper.get('.ingredient-checklist').text()).toContain('400 g')
  })

  it('lädt bei einem Rezeptwechsel das neue Rezept und verwirft die alten Häkchen', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(recipe)).mockResolvedValueOnce(
      jsonResponse({
        ...recipe,
        id: 2,
        title: 'Muffins',
        servings: 12,
      }),
    )

    const { wrapper, router } = await mountPage()
    await flushPromises()

    await wrapper.get('input[type="checkbox"]').setValue(true)
    await router.push('/recipes/2')
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Muffins')
    expect(wrapper.get('.checklist-status').text()).toBe('0 von 2 Zutaten abgehakt')

    await wrapper.get('.servings-trigger').trigger('click')

    expect(wrapper.get('.servings-input').attributes('min')).toBe('12')
  })

  it('zeigt bei HTTP 404 eine verständliche Meldung', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    const { wrapper } = await mountPage()
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Rezept nicht gefunden')
    expect(wrapper.find('.ingredient-checklist').exists()).toBe(false)
  })

  it.each(['abc', '0', '-2', '1.5', '9007199254740992'])(
    'ruft bei der ungültigen ID "%s" das Backend nicht auf',
    async (id) => {
      const { wrapper } = await mountPage(`/recipes/${id}`)
      await flushPromises()

      expect(wrapper.get('h1').text()).toBe('Rezept nicht gefunden')
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('erlaubt nach einem Serverfehler einen erneuten Ladeversuch', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(jsonResponse(recipe))

    const { wrapper } = await mountPage()
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Rezept konnte nicht geladen werden')

    await wrapper.get('.retry-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Pfannkuchen')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('verhindert, dass eine verspätete Antwort das neuere Rezept überschreibt', async () => {
    const pending: { resolve?: (response: Response) => void } = {}

    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            pending.resolve = resolve
          }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...recipe,
          id: 2,
          title: 'Muffins',
        }),
      )

    const { wrapper, router } = await mountPage()

    expect(wrapper.text()).toContain('Rezept wird geladen')

    await router.push('/recipes/2')
    await flushPromises()

    expect(fetchMock.mock.calls[0]?.[1]?.signal).toHaveProperty('aborted', true)
    expect(wrapper.get('h1').text()).toBe('Muffins')

    pending.resolve?.(jsonResponse(recipe))
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Muffins')
  })
})
