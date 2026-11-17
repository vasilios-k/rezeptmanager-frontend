import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import RecipeDeleteConfirmation from '@/components/RecipeDeleteConfirmation.vue'
import { deleteRecipe } from '@/services/recipeService'
import type { Recipe } from '@/types/recipe'

vi.mock('@/services/recipeService', () => ({
  deleteRecipe: vi.fn<typeof deleteRecipe>(),
}))

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')

const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')

const showModalMock = vi.fn<(this: HTMLDialogElement) => void>(function (this: HTMLDialogElement) {
  this.open = true
})

const closeMock = vi.fn<(this: HTMLDialogElement) => void>(function (this: HTMLDialogElement) {
  this.open = false
})

const recipe: Recipe = {
  id: 42,
  title: 'Testbrot',
  ingredients: [
    {
      ingredient: {
        id: 1,
        name: 'Mehl',
      },
      quantity: 250,
      unit: 'GRAM',
    },
  ],
  instructions: 'Zutaten vermischen.',
  prepTimeMinutes: 15,
  servings: 2,
}

let mountedWrapper: VueWrapper | undefined
let initialOverflow = ''
let initialPaddingRight = ''

function mountConfirmation(): VueWrapper {
  const wrapper = mount(RecipeDeleteConfirmation, {
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

beforeEach(() => {
  initialOverflow = document.documentElement.style.overflow
  initialPaddingRight = document.documentElement.style.paddingRight

  vi.mocked(deleteRecipe).mockReset()
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

describe('RecipeDeleteConfirmation', () => {
  it('öffnet den Dialog und stellt die Scroll-Einstellungen beim Schließen wieder her', () => {
    document.documentElement.style.overflow = 'auto'
    document.documentElement.style.paddingRight = '8px'

    const wrapper = mountConfirmation()
    const dialogElement = wrapper.get('dialog').element

    expect(showModalMock).toHaveBeenCalledTimes(1)
    expect(dialogElement).toHaveProperty('open', true)
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.documentElement.style.paddingRight).toBe('24px')
    expect(document.activeElement).toBe(wrapper.get('.cancel-button').element)

    wrapper.unmount()
    mountedWrapper = undefined

    expect(closeMock).toHaveBeenCalledTimes(1)
    expect(dialogElement).toHaveProperty('open', false)
    expect(document.documentElement.style.overflow).toBe('auto')
    expect(document.documentElement.style.paddingRight).toBe('8px')
  })

  it('zeigt den Rezeptnamen und bricht ohne DELETE-Anfrage ab', async () => {
    const wrapper = mountConfirmation()

    expect(wrapper.text()).toContain('Testbrot')

    await wrapper.get('.cancel-button').trigger('click')

    expect(deleteRecipe).not.toHaveBeenCalled()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('deleted')).toBeUndefined()
  })

  it('löscht nach Bestätigung und meldet das gelöschte Rezept', async () => {
    vi.mocked(deleteRecipe).mockResolvedValue(undefined)

    const wrapper = mountConfirmation()

    await wrapper.get('.confirm-delete-button').trigger('click')
    await flushPromises()

    expect(deleteRecipe).toHaveBeenCalledTimes(1)
    expect(deleteRecipe).toHaveBeenCalledWith(42)
    expect(wrapper.emitted('deleted')).toEqual([[recipe]])
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('zeigt Fehler an und hält den Dialog geöffnet', async () => {
    vi.mocked(deleteRecipe).mockRejectedValue(new Error('Simulierter Serverfehler'))

    vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountConfirmation()

    await wrapper.get('.confirm-delete-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Das Rezept konnte nicht gelöscht werden.',
    )
    expect(wrapper.get('dialog').element).toHaveProperty('open', true)
    expect(wrapper.get('fieldset').attributes('disabled')).toBeUndefined()
    expect(wrapper.emitted('deleted')).toBeUndefined()
  })

  it('behandelt das native Escape-Abbrechen ohne DELETE-Anfrage', async () => {
    const wrapper = mountConfirmation()

    const cancelEvent = new Event('cancel', {
      cancelable: true,
    })

    wrapper.get('dialog').element.dispatchEvent(cancelEvent)
    await flushPromises()

    expect(cancelEvent.defaultPrevented).toBe(true)
    expect(deleteRecipe).not.toHaveBeenCalled()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('deleted')).toBeUndefined()
  })

  it('verhindert das Abbrechen während einer laufenden Löschanfrage', async () => {
    const completion: {
      resolve?: () => void
    } = {}

    vi.mocked(deleteRecipe).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          completion.resolve = () => resolve()
        }),
    )

    const wrapper = mountConfirmation()

    await wrapper.get('.confirm-delete-button').trigger('click')

    const cancelEvent = new Event('cancel', {
      cancelable: true,
    })

    wrapper.get('dialog').element.dispatchEvent(cancelEvent)

    expect(cancelEvent.defaultPrevented).toBe(true)
    expect(wrapper.emitted('cancel')).toBeUndefined()
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    expect(deleteRecipe).toHaveBeenCalledTimes(1)

    completion.resolve?.()
    await flushPromises()

    expect(wrapper.emitted('deleted')).toEqual([[recipe]])
  })
})
