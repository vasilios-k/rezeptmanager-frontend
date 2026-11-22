import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import RecipeCosts from '@/components/RecipeCosts.vue'
import IngredientPriceDialog from '@/components/IngredientPriceDialog.vue'
import { searchPrices } from '@/services/priceService'
import {
  priceState,
  removeIngredientPrice,
  setIngredientInPantry,
  setIngredientPrice,
} from '@/stores/prices'
import type { RecipeIngredient } from '@/types/recipe'
import type { ProductPrice } from '@/types/prices'

vi.mock('@/services/priceService', () => ({
  searchPrices: vi.fn<typeof searchPrices>(),
}))

const item: RecipeIngredient = {
  ingredient: { id: 1, name: 'Mehl' },
  quantity: 200,
  unit: 'GRAM',
}

const price: ProductPrice = {
  priceId: 1,
  productId: 1,
  productName: 'Weizenmehl 405',
  packageQuantity: 1000,
  packageUnit: 'GRAM',
  priceCents: 120,
  currency: 'EUR',
  shop: 'Testmarkt',
  city: 'Berlin',
  priceDate: '2025-01-01',
  source: 'OPEN_PRICES',
}

let wrapper: VueWrapper | undefined

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')

const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')

beforeEach(() => {
  removeIngredientPrice(item)
  setIngredientInPantry(item, false)
  localStorage.clear()

  vi.mocked(searchPrices)
    .mockReset()
    .mockResolvedValue({
      offers: [price],
      page: 1,
      hasMore: false,
    })

  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  })

  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    },
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()

  if (originalShowModal) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal)
  } else {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  }

  if (originalClose) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose)
  } else {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  }
})

describe('RecipeCosts', () => {
  it('zeigt fehlende Preise und berechnet nach einer Zuordnung Rezept und Portionskosten', async () => {
    wrapper = mount(RecipeCosts, {
      props: { ingredients: [item], servings: 2 },
    })

    expect(wrapper.get('.consumption-total').text()).toBe('—')
    expect(wrapper.text()).toContain('Teilbeträge')

    setIngredientPrice(item, price)
    await nextTick()

    expect(wrapper.get('.consumption-total').text()).toContain('0,24')
    expect(wrapper.get('.portion-cost').text()).toContain('0,12')

    await wrapper.setProps({
      ingredients: [{ ...item, quantity: 400 }],
      servings: 4,
    })

    expect(wrapper.get('.consumption-total').text()).toContain('0,48')
    expect(wrapper.get('.portion-cost').text()).toContain('0,12')
  })

  it('zieht vorhandene Zutaten vom Einkauf ab und prüft geänderte Mengen neu', async () => {
    setIngredientPrice(item, price)

    wrapper = mount(RecipeCosts, {
      props: { ingredients: [item], shopping: true },
    })

    expect(wrapper.get('.purchase-total').text()).toContain('1,20')

    await wrapper.get('.cost-pantry').setValue(true)

    expect(wrapper.get('.purchase-total').text()).toContain('0,00')
    expect(wrapper.get('.consumption-total').text()).toContain('0,24')

    await wrapper.setProps({
      ingredients: [{ ...item, quantity: 400 }],
    })

    expect(wrapper.get('.cost-pantry').element).toHaveProperty('checked', false)

    expect(wrapper.get('.purchase-total').text()).toContain('1,20')
  })

  it('öffnet den Dialog, übernimmt einen API-Preis und stellt den Fokus wieder her', async () => {
    wrapper = mount(RecipeCosts, {
      props: { ingredients: [item] },
      attachTo: document.body,
    })

    const button = wrapper.get('.cost-edit-price')

    await button.trigger('click')
    await flushPromises()

    expect(wrapper.get('dialog').attributes('open')).toBeDefined()
    expect(document.body.style.overflow).toBe('hidden')

    expect(searchPrices).toHaveBeenCalledWith('Mehl', 'GRAM', 1, expect.any(AbortSignal))

    await wrapper.get('.price-offer').trigger('click')
    await flushPromises()

    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(wrapper.get('.consumption-total').text()).toContain('0,24')
    expect(document.activeElement).toBe(button.element)
    expect(document.body.style.overflow).toBe('')
  })
})

describe('IngredientPriceDialog', () => {
  it('ignoriert eine verspätete Antwort nach einer neuen Suche', async () => {
    let resolveFirst:
      ((value: { offers: ProductPrice[]; page: number; hasMore: boolean }) => void) | undefined

    vi.mocked(searchPrices).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve
      }),
    )

    const newer = {
      ...price,
      priceId: 2,
      productName: 'Anderes Mehl',
    }

    vi.mocked(searchPrices).mockResolvedValueOnce({
      offers: [newer],
      page: 1,
      hasMore: false,
    })

    wrapper = mount(IngredientPriceDialog, {
      props: { item },
      attachTo: document.body,
    })

    await wrapper.get('.price-search-input').setValue('Anderes Mehl')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    resolveFirst?.({
      offers: [price],
      page: 1,
      hasMore: false,
    })

    await flushPromises()

    expect(wrapper.get('.price-offer strong').text()).toBe('Anderes Mehl')

    expect(vi.mocked(searchPrices).mock.calls[0]?.[3]?.aborted).toBe(true)
  })

  it('speichert einen eigenen deutschen Dezimalpreis in Cent', async () => {
    wrapper = mount(IngredientPriceDialog, {
      props: { item },
      attachTo: document.body,
    })

    await wrapper.findAll('.price-tabs button')[1]!.trigger('click')
    await wrapper.get('.manual-price').setValue('1,29')
    await wrapper.get('.manual-shop').setValue('Mein Laden')
    await wrapper.get('.manual-price-form').trigger('submit')

    expect(priceState.prices['1:GRAM']).toMatchObject({
      priceCents: 129,
      source: 'MANUAL',
      shop: 'Mein Laden',
    })

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('weist ungültige Preisangaben zurück', async () => {
    wrapper = mount(IngredientPriceDialog, {
      props: { item },
      attachTo: document.body,
    })

    await wrapper.findAll('.price-tabs button')[1]!.trigger('click')
    await wrapper.get('.manual-price').setValue('-1')
    await wrapper.get('.manual-price-form').trigger('submit')

    expect(wrapper.get('[role="alert"]').text()).toContain('Nachkommastellen')

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('erlaubt bei einem API-Ausfall weiterhin eigene Preise', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(searchPrices).mockRejectedValue(new Error('Offline'))

    wrapper = mount(IngredientPriceDialog, {
      props: { item },
      attachTo: document.body,
    })

    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('eigenen Preis')

    await wrapper.findAll('.price-tabs button')[1]!.trigger('click')

    expect(wrapper.find('.manual-price-form').exists()).toBe(true)
  })
})
