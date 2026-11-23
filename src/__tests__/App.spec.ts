import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, onUnmounted } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { auth0 } from '@/auth/auth0'
import { activeAccount, setActiveAccount } from '@/auth/accountScope'
import { setShoppingRecipe, shoppingListState } from '@/stores/shoppingList'
import { exampleRecipes } from '@/data/exampleRecipes'

vi.mock('@/auth/auth0', async () => {
  const { ref } = await import('vue')
  return {
    auth0: {
      isLoading: ref(false),
      isAuthenticated: ref(false),
      user: ref<{ sub?: string; name?: string; email?: string }>({}),
      error: ref<Error | null>(null),
      loginWithRedirect: vi.fn<() => Promise<void>>(),
      logout: vi.fn<() => Promise<void>>(),
    },
    getApiToken: vi.fn<() => Promise<string>>().mockResolvedValue('test-token'),
  }
})

let wrapper: VueWrapper | undefined
const unmounted = vi.fn<() => void>()
const privateView = defineComponent({
  setup() {
    const ownerAtMount = activeAccount.value
    onUnmounted(unmounted)
    return () => h('p', { class: 'private-content' }, ownerAtMount ?? '')
  },
})

beforeEach(() => {
  setActiveAccount(null)
  localStorage.clear()
  auth0.isLoading.value = false
  auth0.isAuthenticated.value = false
  auth0.user.value = {}
  auth0.error.value = null
  vi.mocked(auth0.loginWithRedirect).mockReset().mockResolvedValue(undefined)
  vi.mocked(auth0.logout).mockReset().mockResolvedValue(undefined)
  unmounted.mockClear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

async function mountApp(path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: privateView }],
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(App, { global: { plugins: [router] } })
  return wrapper
}

function authenticate(subject = 'auth0|alice', name = 'Alice') {
  auth0.user.value = { sub: subject, name }
  auth0.isAuthenticated.value = true
}

describe('Anmeldung und private Seiten', () => {
  it('zeigt während der Anmeldung einen Ladezustand ohne private Inhalte', async () => {
    auth0.isLoading.value = true
    const page = await mountApp()

    expect(page.get('[role="status"]').text()).toContain('Anmeldung')
    expect(page.find('.private-content').exists()).toBe(false)
    expect(page.find('nav').exists()).toBe(false)
  })

  it('bietet ohne Anmeldung Login und Registrierung an', async () => {
    const page = await mountApp()

    expect(page.text()).toContain('Anmelden')
    expect(page.text()).toContain('Konto erstellen')
    expect(page.find('.private-content').exists()).toBe(false)
    expect(activeAccount.value).toBeNull()
  })

  it('öffnet nach der Anmeldung die private Sammlung mit dem angemeldeten Konto', async () => {
    authenticate()
    const page = await mountApp()

    expect(page.get('.account-name').text()).toBe('Alice')
    expect(page.get('.private-content').text()).toBe('auth0|alice')
    expect(page.find('nav').exists()).toBe(true)
  })

  it('merkt sich für die Anmeldung den ursprünglich geöffneten Rezeptlink', async () => {
    const page = await mountApp('/recipes/7?servings=4')
    await page
      .findAll('button')
      .find((button) => button.text() === 'Anmelden')!
      .trigger('click')

    expect(auth0.loginWithRedirect).toHaveBeenCalledWith({
      appState: { target: '/recipes/7?servings=4' },
      authorizationParams: {},
    })
  })

  it('öffnet über Konto erstellen die Registrierung bei Auth0', async () => {
    const page = await mountApp()
    await page
      .findAll('button')
      .find((button) => button.text() === 'Konto erstellen')!
      .trigger('click')

    expect(auth0.loginWithRedirect).toHaveBeenCalledWith({
      appState: { target: '/' },
      authorizationParams: { screen_hint: 'signup' },
    })
  })

  it('entfernt beim Abmelden private Inhalte und Browserzustand schon vor der Weiterleitung', async () => {
    authenticate()
    const page = await mountApp()
    setShoppingRecipe(exampleRecipes[0]!, 4)

    let finish: (() => void) | undefined
    vi.mocked(auth0.logout).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    await page.get('.logout-button').trigger('click')

    expect(activeAccount.value).toBeNull()
    expect(shoppingListState.selections).toEqual([])
    expect(page.find('.private-content').exists()).toBe(false)
    expect(unmounted).toHaveBeenCalledOnce()
    expect(auth0.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    })

    finish?.()
    await flushPromises()
  })

  it('erstellt die private Ansicht beim Kontowechsel neu', async () => {
    authenticate()
    const page = await mountApp()

    authenticate('auth0|bob', 'Bob')
    await flushPromises()

    expect(page.get('.private-content').text()).toBe('auth0|bob')
    expect(page.get('.account-name').text()).toBe('Bob')
    expect(unmounted).toHaveBeenCalledOnce()
  })

  it('zeigt Anmeldefehler und erlaubt einen erneuten Versuch', async () => {
    auth0.error.value = new Error('Anmeldung fehlgeschlagen')
    const page = await mountApp()

    expect(page.get('[role="alert"]').text()).toContain('erneut')
    expect(page.findAll('button').some((button) => button.text() === 'Anmelden')).toBe(true)
    expect(auth0.loginWithRedirect).not.toHaveBeenCalled()
  })
})
