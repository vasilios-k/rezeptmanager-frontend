import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import ShoppingListView from '@/views/ShoppingListView.vue'
import { exampleRecipes } from '@/data/exampleRecipes'
import { getRecipes } from '@/services/recipeService'
import { removeShoppingRecipe, setShoppingRecipe, shoppingListState } from '@/stores/shoppingList'
import type { Recipe } from '@/types/recipe'

vi.mock('@/services/recipeService', () => ({
  getRecipes: vi.fn<typeof getRecipes>(),
}))

let wrapper: VueWrapper | undefined
const recipe = exampleRecipes.find((item) => item.id === 1)!

beforeEach(() => {
  for (const item of shoppingListState.selections) {
    removeShoppingRecipe(item.recipeId)
  }

  localStorage.clear()
  vi.mocked(getRecipes).mockReset().mockResolvedValue(exampleRecipes)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
})

describe('ShoppingListView', () => {
  it('fasst ausgewählte Rezepte zusammen und entfernt abgewählte Rezepte', async () => {
    wrapper = mount(ShoppingListView)
    await flushPromises()

    const choices = wrapper.findAll('.recipe-selection-input')
    await choices[0]!.setValue(true)
    await choices[1]!.setValue(true)

    expect(wrapper.get('.shopping-items').text()).toContain('700 g')
    expect(wrapper.findAll('.shopping-item-checkbox')).toHaveLength(6)

    await choices[1]!.setValue(false)

    expect(wrapper.get('.shopping-items').text()).toContain('200 g')
    expect(wrapper.findAll('.shopping-item-checkbox')).toHaveLength(3)
  })

  it('ändert Portionen über das bestehende Bedienelement und setzt Häkchen zurück', async () => {
    wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.findAll('.recipe-selection-input')[0]!.setValue(true)
    await wrapper.findAll('.shopping-item-checkbox')[0]!.setValue(true)
    await wrapper.findAll('.servings-trigger')[0]!.trigger('click')

    expect(wrapper.get('.decrease-servings').attributes('disabled')).toBeDefined()

    await wrapper.get('.servings-input').setValue('4')

    expect(wrapper.get('.shopping-items').text()).toContain('400 g')
    expect(wrapper.findAll('.shopping-items .checked')).toHaveLength(0)

    await wrapper.findAll('.recipe-selection-input')[0]!.setValue(false)

    expect(shoppingListState.selections).toHaveLength(0)
  })

  it('behält Auswahl und Häkchen beim erneuten Öffnen der Seite', async () => {
    wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.findAll('.recipe-selection-input')[0]!.setValue(true)
    await wrapper.findAll('.shopping-item-checkbox')[0]!.setValue(true)

    wrapper.unmount()
    wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.findAll('.shopping-items .checked')).toHaveLength(1)
    expect(wrapper.findAll('.recipe-selection-input')[0]!.element).toHaveProperty('checked', true)
  })

  it('behält bei Ladefehlern die Auswahl und erlaubt einen neuen Versuch', async () => {
    setShoppingRecipe(recipe, 4)
    vi.mocked(getRecipes).mockRejectedValueOnce(new Error('Offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Deine Auswahl bleibt erhalten')
    expect(shoppingListState.selections).toEqual([{ recipeId: 1, servings: 4 }])

    await wrapper.get('.retry-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.shopping-items').text()).toContain('400 g')
  })

  it('informiert über inzwischen gelöschte Rezepte', async () => {
    setShoppingRecipe(recipe, 2)
    vi.mocked(getRecipes).mockResolvedValue([])

    wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.get('.shopping-notice').text()).toContain('1 gelöschtes Rezept wurde')
    expect(shoppingListState.selections).toHaveLength(0)
  })

  it('ignoriert Antworten nach dem Verlassen der Seite', async () => {
    let resolveRequest: ((recipes: Recipe[]) => void) | undefined

    vi.mocked(getRecipes).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )

    setShoppingRecipe(recipe, 2)
    wrapper = mount(ShoppingListView)
    wrapper.unmount()
    wrapper = undefined

    resolveRequest?.([])
    await flushPromises()

    expect(shoppingListState.selections).toHaveLength(1)
  })
})
