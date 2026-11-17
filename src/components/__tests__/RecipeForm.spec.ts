import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import RecipeForm from '@/components/RecipeForm.vue'
import { createRecipe, updateRecipe } from '@/services/recipeService'
import type { Recipe } from '@/types/recipe'

vi.mock('@/services/recipeService', () => ({
  createRecipe: vi.fn<typeof createRecipe>(),
  updateRecipe: vi.fn<typeof updateRecipe>(),
}))

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')

const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')

const showModalMock = vi.fn<(this: HTMLDialogElement) => void>(function (this: HTMLDialogElement) {
  this.open = true
})

const closeMock = vi.fn<(this: HTMLDialogElement) => void>(function (this: HTMLDialogElement) {
  this.open = false
})

let mountedWrapper: VueWrapper | undefined
let initialOverflow = ''
let initialPaddingRight = ''

function createRecipeFixture(): Recipe {
  return {
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
}

function mountForm(recipe: Recipe | null = null): VueWrapper {
  const wrapper = mount(RecipeForm, {
    attachTo: document.body,
    props: {
      recipe,
    },
  })

  mountedWrapper = wrapper

  return wrapper
}

function restoreDialogMethod(
  method: 'showModal' | 'close',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(HTMLDialogElement.prototype, method, descriptor)
  } else {
    Reflect.deleteProperty(HTMLDialogElement.prototype, method)
  }
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
  initialOverflow = document.documentElement.style.overflow
  initialPaddingRight = document.documentElement.style.paddingRight

  vi.mocked(createRecipe).mockReset()
  vi.mocked(updateRecipe).mockReset()
  showModalMock.mockClear()
  closeMock.mockClear()

  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    writable: true,
    value: showModalMock,
  })

  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    writable: true,
    value: closeMock,
  })

  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(window.innerWidth - 16)
})

afterEach(() => {
  mountedWrapper?.unmount()
  mountedWrapper = undefined

  restoreDialogMethod('showModal', originalShowModal)
  restoreDialogMethod('close', originalClose)

  vi.restoreAllMocks()

  document.documentElement.style.overflow = initialOverflow
  document.documentElement.style.paddingRight = initialPaddingRight
  document.body.innerHTML = ''
})

describe('RecipeForm', () => {
  it('öffnet das Formular als Dialog und stellt den Scrollzustand wieder her', () => {
    document.documentElement.style.overflow = 'auto'
    document.documentElement.style.paddingRight = '8px'

    const wrapper = mountForm()
    const dialogElement = wrapper.get('dialog').element

    expect(showModalMock).toHaveBeenCalledTimes(1)
    expect(dialogElement).toHaveProperty('open', true)
    expect(document.activeElement).toBe(wrapper.get('#recipe-title').element)
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.documentElement.style.paddingRight).toBe('24px')

    wrapper.unmount()
    mountedWrapper = undefined

    expect(closeMock).toHaveBeenCalledTimes(1)
    expect(dialogElement).toHaveProperty('open', false)
    expect(document.documentElement.style.overflow).toBe('auto')
    expect(document.documentElement.style.paddingRight).toBe('8px')
  })

  it('sendet neue Rezeptdaten und meldet das gespeicherte Rezept', async () => {
    const savedRecipe = createRecipeFixture()

    vi.mocked(createRecipe).mockResolvedValue(savedRecipe)

    const wrapper = mountForm()

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

    expect(updateRecipe).not.toHaveBeenCalled()
    expect(wrapper.emitted('saved')).toEqual([[savedRecipe]])
  })

  it('verhindert doppelte Zutaten unabhängig von der Schreibweise', async () => {
    const wrapper = mountForm()

    await fillValidForm(wrapper)
    await wrapper.get('.add-button').trigger('click')
    await wrapper.get('#ingredient-name-1').setValue(' mehl ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createRecipe).not.toHaveBeenCalled()
    expect(updateRecipe).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Bitte gib jede Zutat nur einmal pro Rezept an.',
    )
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('zeigt Speicherfehler an und behält die Eingaben', async () => {
    vi.mocked(createRecipe).mockRejectedValue(new Error('Simulierter Verbindungsfehler'))

    vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountForm()

    await fillValidForm(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Das Rezept konnte nicht gespeichert werden.',
    )
    expect(wrapper.get('#recipe-title').element).toHaveProperty('value', 'Testbrot')
    expect(wrapper.get('fieldset').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('dialog').element).toHaveProperty('open', true)
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('füllt das Bearbeitungsformular mit den vorhandenen Angaben', () => {
    const recipe = createRecipeFixture()

    recipe.ingredients = [
      {
        ingredient: {
          id: 1,
          name: 'Mehl',
        },
        quantity: 0.5,
        unit: 'KILOGRAM',
      },
    ]

    const wrapper = mountForm(recipe)

    expect(wrapper.get('h2').text()).toBe('Rezept bearbeiten')
    expect(wrapper.get('#recipe-title').element).toHaveProperty('value', 'Testbrot')
    expect(wrapper.get('#recipe-prep-time').element).toHaveProperty('value', '15')
    expect(wrapper.get('#recipe-servings').element).toHaveProperty('value', '2')
    expect(wrapper.get('#ingredient-name-0').element).toHaveProperty('value', 'Mehl')
    expect(wrapper.get('#ingredient-quantity-0').element).toHaveProperty('value', '0.5')
    expect(wrapper.get('#ingredient-unit-0').element).toHaveProperty('value', 'KILOGRAM')
    expect(wrapper.get('#recipe-instructions').element).toHaveProperty(
      'value',
      'Zutaten vermischen.',
    )
    expect(wrapper.get('button[type="submit"]').text()).toBe('Änderungen speichern')
  })

  it('aktualisiert ein vorhandenes Rezept mit seiner bisherigen ID', async () => {
    const recipe = createRecipeFixture()

    const updatedRecipe: Recipe = {
      ...recipe,
      title: 'Vollkornbrot',
      ingredients: [
        {
          ingredient: {
            id: 1,
            name: 'Mehl',
          },
          quantity: 500,
          unit: 'GRAM',
        },
      ],
    }

    vi.mocked(updateRecipe).mockResolvedValue(updatedRecipe)

    const wrapper = mountForm(recipe)

    await wrapper.get('#recipe-title').setValue('Vollkornbrot')
    await wrapper.get('#ingredient-quantity-0').setValue('500')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updateRecipe).toHaveBeenCalledTimes(1)
    expect(updateRecipe).toHaveBeenCalledWith(42, {
      title: 'Vollkornbrot',
      ingredients: [
        {
          ingredientName: 'Mehl',
          quantity: 500,
          unit: 'GRAM',
        },
      ],
      instructions: 'Zutaten vermischen.',
      prepTimeMinutes: 15,
      servings: 2,
    })

    expect(createRecipe).not.toHaveBeenCalled()
    expect(wrapper.emitted('saved')).toEqual([[updatedRecipe]])
  })

  it.each([
    ['Abbrechen', '.form-actions button[type="button"]'],
    ['Schließen', '.close-dialog-button'],
  ])('verwirft Änderungen über %s', async (_label, selector) => {
    const recipe = createRecipeFixture()
    const wrapper = mountForm(recipe)

    await wrapper.get('#recipe-title').setValue('Nicht speichern')
    await wrapper.get('#ingredient-quantity-0').setValue('999')
    await wrapper.get(selector).trigger('click')

    expect(recipe.title).toBe('Testbrot')
    expect(recipe.ingredients.map((item) => item.quantity)).toEqual([250.5])
    expect(createRecipe).not.toHaveBeenCalled()
    expect(updateRecipe).not.toHaveBeenCalled()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('bricht über das native Escape-Ereignis ohne Speicherung ab', async () => {
    const wrapper = mountForm()

    const cancelEvent = new Event('cancel', {
      cancelable: true,
    })

    wrapper.get('dialog').element.dispatchEvent(cancelEvent)
    await flushPromises()

    expect(cancelEvent.defaultPrevented).toBe(true)
    expect(createRecipe).not.toHaveBeenCalled()
    expect(updateRecipe).not.toHaveBeenCalled()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('verhindert das Schließen während des Speicherns', async () => {
    const savedRecipe = createRecipeFixture()

    const completion: {
      resolve?: () => void
    } = {}

    vi.mocked(createRecipe).mockImplementation(
      () =>
        new Promise<Recipe>((resolve) => {
          completion.resolve = () => resolve(savedRecipe)
        }),
    )

    const wrapper = mountForm()

    await fillValidForm(wrapper)
    await wrapper.get('form').trigger('submit')

    const cancelEvent = new Event('cancel', {
      cancelable: true,
    })

    wrapper.get('dialog').element.dispatchEvent(cancelEvent)

    expect(cancelEvent.defaultPrevented).toBe(true)
    expect(wrapper.emitted('cancel')).toBeUndefined()
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.close-dialog-button').attributes('disabled')).toBeDefined()
    expect(createRecipe).toHaveBeenCalledTimes(1)

    completion.resolve?.()
    await flushPromises()

    expect(wrapper.emitted('saved')).toEqual([[savedRecipe]])
  })
})
