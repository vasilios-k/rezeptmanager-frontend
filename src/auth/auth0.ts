import { createAuth0 } from '@auth0/auth0-vue'
import { activeAccount } from '@/auth/accountScope'

export const auth0 = createAuth0({
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  authorizationParams: {
    audience: import.meta.env.VITE_AUTH0_AUDIENCE,
    redirect_uri: window.location.origin,
    scope: 'openid profile email',
  },
  cacheLocation: 'memory',
  useRefreshTokens: true,
  useRefreshTokensFallback: true,
})

export async function getApiToken(): Promise<string> {
  if (!activeAccount.value || !auth0.isAuthenticated.value) {
    throw new Error('Bitte zuerst anmelden.')
  }

  const token = await auth0.getAccessTokenSilently()

  if (!token) throw new Error('Bitte erneut anmelden.')

  return token
}
