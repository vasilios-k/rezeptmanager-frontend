import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

vi.mock('@/auth/auth0', () => ({
  getApiToken: vi.fn<() => Promise<string>>(),
}))

const fetchMock = vi.fn<typeof fetch>()

beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  const { setActiveAccount } = await import('@/auth/accountScope')
  const { getApiToken } = await import('@/auth/auth0')
  setActiveAccount('auth0|alice')
  vi.mocked(getApiToken).mockReset().mockResolvedValue('alice-token')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Authentifizierte API-Anfragen', () => {
  it('holt das aktuelle Zugriffstoken und sendet es im Authorization-Header', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }))
    const { requestApi } = await import('@/services/apiClient')

    await expect(requestApi('/api/recipes/1')).resolves.toEqual({ id: 1 })

    const options = fetchMock.mock.calls[0]?.[1]
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer alice-token')
    expect(new Headers(options?.headers).get('Accept')).toBe('application/json')
  })

  it('sendet ohne aktives Konto keine API-Anfrage', async () => {
    const { setActiveAccount } = await import('@/auth/accountScope')
    const { requestApi } = await import('@/services/apiClient')
    setActiveAccount(null)

    await expect(requestApi('/api/recipes')).rejects.toThrow('anmelden')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('verwirft eine alte Antwort beim Kontowechsel, auch wenn fetch einen Abbruch ignoriert', async () => {
    let finish: ((value: Response) => void) | undefined
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { requestApi } = await import('@/services/apiClient')
    const { setActiveAccount } = await import('@/auth/accountScope')
    const result = requestApi('/api/recipes').catch((failure: unknown) => failure)
    await flushPromises()

    const signal = fetchMock.mock.calls[0]?.[1]?.signal
    setActiveAccount('auth0|bob')
    expect(signal?.aborted).toBe(true)
    finish?.(new Response(JSON.stringify([{ title: 'Alices privates Rezept' }]), { status: 200 }))
    await expect(result).resolves.toMatchObject({ name: 'AbortError' })
  })

  it('verwirft eine Antwort auch beim Kontowechsel während des Lesens des JSON-Inhalts', async () => {
    let finish: ((value: unknown) => void) | undefined
    const response = new Response(null, { status: 200 })
    vi.spyOn(response, 'json').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    fetchMock.mockResolvedValue(response)
    const { requestApi } = await import('@/services/apiClient')
    const { setActiveAccount } = await import('@/auth/accountScope')
    const result = requestApi('/api/recipes').catch((failure: unknown) => failure)
    await flushPromises()

    setActiveAccount('auth0|bob')
    finish?.([{ title: 'Alices privates Rezept' }])
    await expect(result).resolves.toMatchObject({ name: 'AbortError' })
  })

  it('verwendet ein verspätet geliefertes Token nach einem Kontowechsel nicht mehr', async () => {
    const { getApiToken } = await import('@/auth/auth0')
    let finish: ((value: string) => void) | undefined
    vi.mocked(getApiToken).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { requestApi } = await import('@/services/apiClient')
    const { setActiveAccount } = await import('@/auth/accountScope')
    const result = requestApi('/api/recipes').catch((failure: unknown) => failure)

    setActiveAccount('auth0|bob')
    finish?.('old-alice-token')
    await expect(result).resolves.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('beendet bei HTTP 401 die lokale Sitzung und fordert eine neue Anmeldung an', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
    const { requestApi } = await import('@/services/apiClient')
    const { activeAccount, authNotice } = await import('@/auth/accountScope')

    await expect(requestApi('/api/recipes')).rejects.toThrow('erneut')
    expect(activeAccount.value).toBeNull()
    expect(authNotice.value).toContain('erneut')
  })

  it('erlaubt nach einer abgelaufenen Auth0-Sitzung eine interaktive Neuanmeldung', async () => {
    const { getApiToken } = await import('@/auth/auth0')
    vi.mocked(getApiToken).mockRejectedValue({ error: 'login_required' })
    const { requestApi } = await import('@/services/apiClient')
    const { activeAccount } = await import('@/auth/accountScope')

    await expect(requestApi('/api/recipes')).rejects.toThrow('erneut')
    expect(activeAccount.value).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('übernimmt das externe Abbruchsignal für eine laufende Anfrage', async () => {
    let finish: ((value: Response) => void) | undefined
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { requestApi } = await import('@/services/apiClient')
    const controller = new AbortController()
    const result = requestApi('/api/recipes', { signal: controller.signal }).catch(
      (failure: unknown) => failure,
    )
    await flushPromises()

    controller.abort()
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    finish?.(new Response('[]', { status: 200 }))
    await expect(result).resolves.toMatchObject({ name: 'AbortError' })
  })
})
