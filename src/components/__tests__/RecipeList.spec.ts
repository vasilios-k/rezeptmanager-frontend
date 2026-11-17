import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RecipeList from '@/components/RecipeList.vue'
import type { Recipe } from '@/types/recipe'

const recipes: Recipe[] = [
  {
    id: 1,
    title: 'Testbrot',
    ingredients: [
      {
        ingredient: {
          id: 1,
          name: 'Mehl',
        },
        quantity: 250.5,
        unit: 'GRAM',
      },
      {
        ingredient: {
          id: 2,
          name: 'Salz',
        },
        quantity: 2,
        unit: 'PINCH',
      },
    ],
    instructions: 'Zutaten vermischen und backen.',
    prepTimeMinutes: 15,
    servings: 2,
  },
]

describe('RecipeList', () => {
  it('zeigt Rezepte und formatiert Zutatenmengen auf Deutsch', () => {
    const wrapper = mount(RecipeList, {
      props: {
        recipes,
      },
    })

    expect(wrapper.findAll('article')).toHaveLength(1)
    expect(wrapper.get('h2').text()).toBe('Testbrot')
    expect(wrapper.get('.recipe-count').text()).toMatch(/^1\s+Rezept$/)
    expect(wrapper.get('.recipe-meta').text()).toContain('15 Min.')
    expect(wrapper.get('.recipe-meta').text()).toContain('2 Portionen')

    const ingredientList = wrapper.get('.ingredient-list').text()

    expect(ingredientList).toContain('Mehl')
    expect(ingredientList).toContain('250,5 g')
    expect(ingredientList).toContain('Salz')
    expect(ingredientList).toContain('2 Prisen')
  })

  it('zeigt einen Hinweis, wenn keine Rezepte vorhanden sind', () => {
    const wrapper = mount(RecipeList, {
      props: {
        recipes: [],
      },
    })

    expect(wrapper.find('article').exists()).toBe(false)
    expect(wrapper.get('.empty-state').text()).toBe('Es sind noch keine Rezepte vorhanden.')
  })

  it('meldet das ausgewählte Rezept beim Klick auf Bearbeiten', async () => {
    const wrapper = mount(RecipeList, {
      props: {
        recipes,
      },
    })

    await wrapper.get('.edit-button').trigger('click')

    expect(wrapper.emitted('edit')).toEqual([[recipes[0]]])
  })

  it('meldet das ausgewählte Rezept beim Klick auf Löschen', async () => {
    const wrapper = mount(RecipeList, {
      props: {
        recipes,
      },
    })

    await wrapper.get('.delete-button').trigger('click')

    expect(wrapper.emitted('delete')).toEqual([[recipes[0]]])
  })

  it('sperrt Bearbeiten und Löschen während einer anderen Aktion', async () => {
    const wrapper = mount(RecipeList, {
      props: {
        recipes,
        actionsDisabled: true,
      },
    })

    expect(wrapper.get('.edit-button').attributes('disabled')).toBeDefined()

    expect(wrapper.get('.delete-button').attributes('disabled')).toBeDefined()

    await wrapper.get('.edit-button').trigger('click')
    await wrapper.get('.delete-button').trigger('click')

    expect(wrapper.emitted('edit')).toBeUndefined()
    expect(wrapper.emitted('delete')).toBeUndefined()
  })
})
