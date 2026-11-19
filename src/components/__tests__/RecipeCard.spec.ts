import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import RecipeCard from '@/components/RecipeCard.vue'
import RecipeList from '@/components/RecipeList.vue'
import { exampleRecipes } from '@/data/exampleRecipes'
import type { Recipe } from '@/types/recipe'

const recipe: Recipe = {
  id: 42,
  title: 'Pfannkuchen',
  ingredients: [
    { ingredient: { id: 1, name: 'Mehl' }, quantity: 200, unit: 'GRAM' },
    { ingredient: { id: 2, name: 'Eier' }, quantity: 2, unit: 'PIECE' },
    { ingredient: { id: 3, name: 'Milch' }, quantity: 300, unit: 'MILLILITER' },
  ],
  instructions: 'Zutaten verrühren und in der Pfanne ausbacken.',
  prepTimeMinutes: 25,
  servings: 2,
}

const wrappers: VueWrapper[] = []

function mountCard(actionsDisabled = false) {
  const wrapper = mount(RecipeCard, {
    attachTo: document.body,
    props: { recipe, actionsDisabled },
  })

  wrappers.push(wrapper)
  return wrapper
}

async function openServings(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('.servings-trigger').trigger('click')
}

afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers.length = 0
  document.body.innerHTML = ''
})

describe('RecipeCard portions', () => {
  it('zeigt zuerst nur die anklickbare Portionszahl', () => {
    const wrapper = mountCard()

    expect(wrapper.get('.servings-trigger').text()).toBe('2 Portionen')
    expect(wrapper.find('.servings-editor').exists()).toBe(false)
    expect(wrapper.get('.ingredient-list').text()).toContain('200 g')
  })

  it('öffnet die Pfeile und fokussiert das Eingabefeld', async () => {
    const wrapper = mountCard()
    await openServings(wrapper)

    const input = wrapper.get<HTMLInputElement>('.servings-input')

    expect(input.element.value).toBe('2')
    expect(input.attributes('min')).toBe('2')
    expect(document.activeElement).toBe(input.element)
    expect(wrapper.get('.decrease-servings').attributes('disabled')).toBeDefined()
  })

  it('berechnet wiederholte Änderungen vom Original aus und bestätigt mit Enter', async () => {
    const wrapper = mountCard()
    const original = structuredClone(recipe)

    await openServings(wrapper)
    await wrapper.get('.servings-input').setValue('4')

    expect(wrapper.get('.ingredient-list').text()).toContain('400 g')

    await wrapper.get('.servings-input').setValue('6')

    expect(wrapper.get('.ingredient-list').text()).toContain('600 g')
    expect(wrapper.get('.ingredient-list').text()).toContain('6 Stk.')
    expect(wrapper.get('.ingredient-list').text()).toContain('900 ml')

    await wrapper.get('.servings-input').trigger('keydown', { key: 'Enter' })

    expect(wrapper.find('.servings-editor').exists()).toBe(false)
    expect(wrapper.get('.servings-trigger').text()).toBe('6 Portionen')
    expect(document.activeElement).toBe(wrapper.get('.servings-trigger').element)
    expect(recipe).toEqual(original)
  })

  it('erhöht und verringert mit den Pfeilen bis zur Originalportionszahl', async () => {
    const wrapper = mountCard()

    await openServings(wrapper)
    await wrapper.get('.increase-servings').trigger('click')

    expect(wrapper.get<HTMLInputElement>('.servings-input').element.value).toBe('3')
    expect(wrapper.get('.ingredient-list').text()).toContain('300 g')

    await wrapper.get('.decrease-servings').trigger('click')
    await wrapper.get('.decrease-servings').trigger('click')

    expect(wrapper.get<HTMLInputElement>('.servings-input').element.value).toBe('2')
    expect(wrapper.get('.decrease-servings').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.ingredient-list').text()).toContain('200 g')
  })

  it('setzt mit dem Rücksetzknopf auf das Original zurück', async () => {
    const wrapper = mountCard()

    await openServings(wrapper)
    await wrapper.get('.servings-input').setValue('6')
    await wrapper.get('.reset-servings').trigger('click')

    expect(wrapper.get<HTMLInputElement>('.servings-input').element.value).toBe('2')
    expect(wrapper.get('.ingredient-list').text()).toContain('200 g')
    expect(document.activeElement).toBe(wrapper.get('.servings-input').element)
  })

  it.each(['0', '-1', '1'])(
    'übernimmt die Tastatureingabe %s unterhalb des Originalwerts nicht',
    async (value) => {
      const wrapper = mountCard()

      await openServings(wrapper)
      await wrapper.get('.servings-input').setValue('4')
      await wrapper.get('.servings-input').setValue(value)

      expect(wrapper.get('.servings-input').attributes('aria-invalid')).toBe('true')
      expect(wrapper.get('.ingredient-list').text()).toContain('400 g')

      await wrapper.get('.servings-input').trigger('keydown', { key: 'Enter' })

      expect(wrapper.get('.servings-trigger').text()).toBe('2 Portionen')
      expect(wrapper.get('.ingredient-list').text()).toContain('200 g')
    },
  )

  it.each(['', '1.5'])(
    'behält bei der ungültigen Eingabe "%s" die letzte gültige Portionszahl',
    async (value) => {
      const wrapper = mountCard()

      await openServings(wrapper)
      await wrapper.get('.servings-input').setValue('4')
      await wrapper.get('.servings-input').setValue(value)
      await wrapper.get('.servings-input').trigger('keydown', { key: 'Enter' })

      expect(wrapper.get('.servings-trigger').text()).toBe('4 Portionen')
      expect(wrapper.get('.ingredient-list').text()).toContain('400 g')
    },
  )

  it('verwirft mit Escape die aktuelle Bearbeitung', async () => {
    const wrapper = mountCard()

    await openServings(wrapper)
    await wrapper.get('.servings-input').setValue('6')
    await wrapper.get('.servings-input').trigger('keydown', { key: 'Escape' })

    expect(wrapper.get('.servings-trigger').text()).toBe('2 Portionen')
    expect(wrapper.get('.ingredient-list').text()).toContain('200 g')
    expect(document.activeElement).toBe(wrapper.get('.servings-trigger').element)
  })

  it('bleibt beim Fokuswechsel zu einem Pfeil geöffnet', async () => {
    const wrapper = mountCard()
    await openServings(wrapper)

    await wrapper.get('.servings-input').trigger('focusout', {
      relatedTarget: wrapper.get('.increase-servings').element,
    })

    await wrapper.get('.increase-servings').trigger('click')

    expect(wrapper.find('.servings-editor').exists()).toBe(true)
    expect(wrapper.get<HTMLInputElement>('.servings-input').element.value).toBe('3')
  })

  it('schließt beim Verlassen mit Tab und lässt den Fokus am nächsten Element', async () => {
    const wrapper = mountCard()

    await openServings(wrapper)
    await wrapper.get('.servings-input').setValue('4')

    const outsideButton = document.createElement('button')
    document.body.append(outsideButton)
    outsideButton.focus()

    await nextTick()

    expect(wrapper.get('.servings-trigger').text()).toBe('4 Portionen')
    expect(document.activeElement).toBe(outsideButton)
  })

  it('schließt beim Klick außerhalb der Portionssteuerung', async () => {
    const wrapper = mountCard()

    await openServings(wrapper)
    await wrapper.get('.servings-input').setValue('4')

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()

    expect(wrapper.find('.servings-editor').exists()).toBe(false)
    expect(wrapper.get('.servings-trigger').text()).toBe('4 Portionen')
  })

  it('rechnet mehrere Rezeptkarten unabhängig voneinander um', async () => {
    const wrapper = mount(RecipeList, { props: { recipes: exampleRecipes } })
    wrappers.push(wrapper)

    const [first, second] = wrapper.findAllComponents(RecipeCard)

    if (!first || !second) {
      throw new Error('Zwei Rezeptkarten erwartet.')
    }

    await openServings(first)
    await first.get('.servings-input').setValue('4')

    expect(first.get('.ingredient-list').text()).toContain('400 g')
    expect(second.get('.ingredient-list').text()).toContain('500 g')
    expect(second.get('.servings-trigger').text()).toBe('4 Portionen')
  })

  it('übernimmt nach dem Bearbeiten auch die neue Mindestportionszahl', async () => {
    const wrapper = mountCard()

    await openServings(wrapper)
    await wrapper.get('.servings-input').setValue('6')

    await wrapper.setProps({
      recipe: {
        ...recipe,
        servings: 3,
        ingredients: [{ ingredient: { id: 1, name: 'Mehl' }, quantity: 90, unit: 'GRAM' }],
      },
    })

    expect(wrapper.get('.servings-trigger').text()).toBe('3 Portionen')

    await openServings(wrapper)

    expect(wrapper.get('.servings-input').attributes('min')).toBe('3')
    expect(wrapper.get('.decrease-servings').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.ingredient-list').text()).toContain('90 g')
  })

  it('übergibt beim Bearbeiten und Löschen das gespeicherte Originalrezept', async () => {
    const wrapper = mountCard()

    await openServings(wrapper)
    await wrapper.get('.servings-input').setValue('4')
    await wrapper.get('.edit-button').trigger('click')
    await wrapper.get('.delete-button').trigger('click')

    expect(wrapper.emitted('edit')).toEqual([[recipe]])
    expect(wrapper.emitted('delete')).toEqual([[recipe]])
    expect(recipe.servings).toBe(2)
  })

  it('sperrt Portionsauswahl und Rezeptaktionen während eines Dialogs', async () => {
    const wrapper = mountCard(true)

    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('disabled')).toBeDefined()
      await button.trigger('click')
    }

    expect(wrapper.find('.servings-editor').exists()).toBe(false)
    expect(wrapper.emitted('edit')).toBeUndefined()
    expect(wrapper.emitted('delete')).toBeUndefined()
  })

  it('schließt eine geöffnete Portionssteuerung, wenn ein anderer Dialog geöffnet wird', async () => {
    const wrapper = mountCard()

    await openServings(wrapper)
    await wrapper.setProps({ actionsDisabled: true })

    expect(wrapper.find('.servings-editor').exists()).toBe(false)
    expect(wrapper.get('.servings-trigger').attributes('disabled')).toBeDefined()
  })
})
