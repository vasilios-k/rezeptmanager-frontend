import { watch } from 'vue'
import { getApiToken } from '@/auth/auth0'
import { activeAccount, invalidateAccount } from '@/auth/accountScope'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '')
const activeRequests = new Set<AbortController>()

watch(
  activeAccount,
  () => {
    for (const request of activeRequests) request.abort()
    activeRequests.clear()
  },
  { flush: 'sync' },
)

interface ApiRequestOptions extends RequestInit {
  allowNotFound?: boolean
  errorMessage?: string
}

function aborted(): DOMException {
  return new DOMException('Die Anfrage wurde abgebrochen.', 'AbortError')
}

function requiresLogin(failure: unknown): boolean {
  return (
    typeof failure === 'object' &&
    failure !== null &&
    'error' in failure &&
    typeof failure.error === 'string' &&
    ['login_required', 'consent_required', 'interaction_required', 'invalid_grant'].includes(
      failure.error,
    )
  )
}

export async function requestApi<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (!apiBaseUrl) throw new Error('Die Backend-Adresse ist nicht konfiguriert.')

  const owner = activeAccount.value

  if (!owner) throw new Error('Bitte zuerst anmelden.')

  const {
    signal,
    allowNotFound = false,
    errorMessage = 'Die Anfrage ist fehlgeschlagen',
    ...requestOptions
  } = options

  const controller = new AbortController()
  const cancel = () => controller.abort()

  if (signal?.aborted) throw aborted()

  signal?.addEventListener('abort', cancel, { once: true })
  activeRequests.add(controller)

  function assertCurrentAccount(): void {
    if (controller.signal.aborted || activeAccount.value !== owner) throw aborted()
  }

  try {
    const token = await getApiToken()
    assertCurrentAccount()

    const headers = new Headers(requestOptions.headers)
    headers.set('Accept', 'application/json')
    headers.set('Authorization', `Bearer ${token}`)

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...requestOptions,
      headers,
      signal: controller.signal,
    })

    assertCurrentAccount()

    if (response.status === 401) {
      const message = 'Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.'
      invalidateAccount(owner, message)
      throw new Error(message)
    }

    if (response.status === 404 && allowNotFound) return null as T

    if (!response.ok) throw new Error(`${errorMessage}: HTTP ${response.status}`)

    if (response.status === 204) return undefined as T

    const data: unknown = await response.json()
    assertCurrentAccount()

    return data as T
  } catch (failure) {
    if (requiresLogin(failure)) {
      const message = 'Bitte melde dich erneut an, um fortzufahren.'
      invalidateAccount(owner, message)
      throw new Error(message)
    }

    throw failure
  } finally {
    activeRequests.delete(controller)
    signal?.removeEventListener('abort', cancel)
  }
}
