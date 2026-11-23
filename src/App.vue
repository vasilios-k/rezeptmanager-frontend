<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import AuthWelcome from '@/components/auth/AuthWelcome.vue'
import { auth0 } from '@/auth/auth0'
import { activeAccount, authNotice, setActiveAccount } from '@/auth/accountScope'
import { startShoppingSync } from '@/stores/shoppingSync'

const route = useRoute()
const busy = ref(false)
const actionError = ref('')
const { isLoading, isAuthenticated, user, error } = auth0
const { state: shoppingSync, retry: retrySync, stop: stopSync } = startShoppingSync()
onBeforeUnmount(stopSync)

watch(
  [isLoading, isAuthenticated, user],
  () => {
    setActiveAccount(!isLoading.value && isAuthenticated.value ? (user.value?.sub ?? null) : null)
  },
  { immediate: true, flush: 'sync' },
)

const signedIn = computed(() => isAuthenticated.value && activeAccount.value !== null)
const displayName = computed(() => user.value?.name || user.value?.email || 'Angemeldet')
const errorMessage = computed(
  () =>
    actionError.value ||
    authNotice.value ||
    (error.value
      ? 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.'
      : ''),
)

async function login(signup = false): Promise<void> {
  busy.value = true
  actionError.value = ''

  try {
    await auth0.loginWithRedirect({
      appState: { target: route.fullPath },
      authorizationParams: signup ? { screen_hint: 'signup' } : {},
    })
  } catch (failure) {
    console.error('Anmeldung fehlgeschlagen:', failure)
    actionError.value = 'Die Anmeldung konnte nicht geöffnet werden. Bitte versuche es erneut.'
  } finally {
    busy.value = false
  }
}

async function logout(): Promise<void> {
  busy.value = true
  actionError.value = ''
  setActiveAccount(null)

  try {
    await auth0.logout({ logoutParams: { returnTo: window.location.origin } })
  } catch (failure) {
    console.error('Abmeldung fehlgeschlagen:', failure)
    actionError.value = 'Die Abmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <header class="app-header">
    <div class="container app-header-inner">
      <RouterLink to="/" class="brand">
        <span class="brand-mark" aria-hidden="true">R</span>
        <span>Rezeptmanager</span>
      </RouterLink>

      <template v-if="signedIn">
        <nav aria-label="Hauptnavigation">
          <RouterLink to="/" class="navigation-link">Meine Rezepte</RouterLink>
          <RouterLink to="/shopping-list" class="navigation-link">Einkaufsliste</RouterLink>
        </nav>

        <div class="account-actions">
          <span class="account-name" :title="displayName">{{ displayName }}</span>
          <button type="button" class="logout-button" :disabled="busy" @click="logout">
            Abmelden
          </button>
        </div>
      </template>
    </div>
  </header>

  <main class="container app-main">
    <template v-if="signedIn">
      <div
        v-if="shoppingSync.ready"
        class="sync-feedback"
        :class="{ 'sync-error': shoppingSync.error }"
      >
        <p :role="shoppingSync.error ? 'alert' : 'status'" aria-live="polite">
          {{
            shoppingSync.error ||
            (shoppingSync.loading || shoppingSync.saving || shoppingSync.pending
              ? 'Einkaufsliste wird synchronisiert …'
              : 'Einkaufsliste synchronisiert')
          }}
        </p>
        <button
          v-if="shoppingSync.error"
          type="button"
          :disabled="shoppingSync.loading || shoppingSync.saving"
          @click="retrySync"
        >
          Erneut versuchen
        </button>
      </div>
      <RouterView v-if="shoppingSync.ready" :key="activeAccount ?? 'anonymous'" />
      <p v-else class="empty-state" role="status">
        Deine gespeicherte Einkaufsliste wird geladen …
      </p>
    </template>
    <AuthWelcome
      v-else
      :loading="isLoading"
      :busy="busy"
      :error-message="errorMessage"
      @login="login()"
      @signup="login(true)"
    />
  </main>
</template>

<style scoped>
.sync-feedback {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-bottom: 20px;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.sync-feedback p {
  margin: 0;
}
.sync-error {
  color: #a32929;
}
.sync-feedback button {
  min-height: 44px;
  padding: 8px 14px;
  border: 1px solid currentColor;
  border-radius: 8px;
  background: #fff;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.sync-feedback button:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

.app-header-inner {
  flex-wrap: wrap;
  gap: 12px 24px;
  padding-block: 16px;
}

nav,
.account-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 24px;
}

.navigation-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}

.navigation-link.router-link-exact-active {
  text-decoration: underline;
  text-underline-offset: 5px;
}

.account-name {
  max-width: min(280px, 70vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9rem;
  color: var(--color-muted);
}

.logout-button {
  min-height: 44px;
  padding: 8px 14px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  background: #fff;
  color: var(--color-primary);
  font: inherit;
  cursor: pointer;
}

.logout-button:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

.logout-button:disabled {
  opacity: 0.6;
  cursor: wait;
}
</style>
