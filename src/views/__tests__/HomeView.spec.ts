import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import HomeView from '@/views/HomeView.vue'
import { exampleRecipes } from '@/data/exampleRecipes'
import { createRecipe, deleteRecipe, getRecipes, updateRecipe } from '@/services/recipeService'

vi.mock('@/services/recipeService', () => ({
  getRecipes: vi.fn<typeof getRecipes>(),
  createRecipe: vi.fn<typeof createRecipe>(),
  updateRecipe: vi.fn<typeof updateRecipe>(),
  deleteRecipe: vi.fn<typeof deleteRecipe>(),
}))

let mountedWrapper: VueWrapper | undefined

function mountHome(): VueWrapper {
  const wrapper = mount(HomeView)
  mountedWrapper = wrapper

  return wrapper
}

function recipeTitles(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.recipe-card h2').map((heading) => heading.text())
}

beforeEach(() => {
  vi.mocked(getRecipes).mockReset()
  vi.mocked(createRecipe).mockReset()
  vi.mocked(updateRecipe).mockReset()
  vi.mocked(deleteRecipe).mockReset()

  vi.mocked(getRecipes).mockResolvedValue(exampleRecipes)
})

afterEach(() => {
  mountedWrapper?.unmount()
  mountedWrapper = undefined
  vi.restoreAllMocks()
})

describe('HomeView recipe search', () => {
  it('filtert nach Namen und Zutaten und setzt die Suche zurück', async () => {
    const wrapper = mountHome()

    await flushPromises()

    expect(recipeTitles(wrapper)).toEqual(['Pfannkuchen', 'Brot'])

    await wrapper.get('#recipe-search').setValue('PFANN')

    expect(recipeTitles(wrapper)).toEqual(['Pfannkuchen'])
    expect(wrapper.get('.recipe-count').text()).toMatch(/^1\s+Rezept$/)

    await wrapper.get('#recipe-search').setValue('Mehl')

    expect(recipeTitles(wrapper)).toEqual(['Pfannkuchen', 'Brot'])

    await wrapper.get('#recipe-search').setValue('Milch')

    expect(recipeTitles(wrapper)).toEqual(['Pfannkuchen'])

    await wrapper.get('.reset-search-button').trigger('click')

    expect(wrapper.get('#recipe-search').element).toHaveProperty('value', '')
    expect(recipeTitles(wrapper)).toEqual(['Pfannkuchen', 'Brot'])
    expect(getRecipes).toHaveBeenCalledTimes(1)
  })

  it('zeigt einen Suchhinweis bei fehlenden Treffern', async () => {
    const wrapper = mountHome()

    await flushPromises()

    await wrapper.get('#recipe-search').setValue('Kokosnuss')

    expect(wrapper.findAll('.recipe-card')).toHaveLength(0)
    expect(wrapper.get('.empty-state').text()).toContain('Keine passenden Rezepte')
    expect(wrapper.get('.empty-state').text()).toContain('Kokosnuss')

    await wrapper.get('.reset-search-button').trigger('click')

    expect(recipeTitles(wrapper)).toEqual(['Pfannkuchen', 'Brot'])
    expect(getRecipes).toHaveBeenCalledTimes(1)
  })
})
