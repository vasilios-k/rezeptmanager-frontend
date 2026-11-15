import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import RecipeForm from '@/components/RecipeForm.vue'
import { createRecipe } from '@/services/recipeService'
import type { Recipe } from '@/types/recipe'

vi.mock('@/services/recipeService', () => ({
  createRecipe: vi.fn<typeof createRecipe>(),
}))

const savedRecipe: Recipe = {
  id: 42,
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
  ],
  instructions: 'Zutaten vermischen.',
  prepTimeMinutes: 15,
  servings: 2,
}

async function fillValidForm(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('#recipe-title').setValue('Testbrot')
  await wrapper.get('#recipe-prep-time').setValue('15')
  await wrapper.get('#recipe-servings').setValue('2')
  await wrapper.get('#ingredient-name-0').setValue(' Mehl ')
  await wrapper.get('#ingredient-quantity-0').setValue('250.5')
  await wrapper.get('#ingredient-unit-0').setValue('GRAM')
  await wrapper.get('#recipe-instructions').setValue('Zutaten vermischen.')
}

beforeEach(() => {
  vi.mocked(createRecipe).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RecipeForm', () => {
  it('sendet gültige Rezeptdaten und meldet das gespeicherte Rezept', async () => {
    vi.mocked(createRecipe).mockResolvedValue(savedRecipe)

    const wrapper = mount(RecipeForm)

    await fillValidForm(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createRecipe).toHaveBeenCalledTimes(1)
    expect(createRecipe).toHaveBeenCalledWith({
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
    })

    expect(wrapper.emitted('created')).toEqual([[savedRecipe]])
  })

  it('verhindert doppelte Zutaten unabhängig von der Schreibweise', async () => {
    const wrapper = mount(RecipeForm)

    await fillValidForm(wrapper)
    await wrapper.get('.add-button').trigger('click')
    await wrapper.get('#ingredient-name-1').setValue(' mehl ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createRecipe).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Bitte gib jede Zutat nur einmal pro Rezept an.',
    )
    expect(wrapper.emitted('created')).toBeUndefined()
  })

  it('zeigt Speicherfehler an und behält die Eingaben', async () => {
    vi.mocked(createRecipe).mockRejectedValue(new Error('Simulierter Verbindungsfehler'))

    vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mount(RecipeForm)

    await fillValidForm(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Das Rezept konnte nicht gespeichert werden.',
    )
    expect(wrapper.get('#recipe-title').element).toHaveProperty('value', 'Testbrot')
    expect(wrapper.get('fieldset').attributes('disabled')).toBeUndefined()
    expect(wrapper.emitted('created')).toBeUndefined()
  })
})
