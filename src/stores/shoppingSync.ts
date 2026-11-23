import { reactive, readonly, watch } from 'vue'
import { activeAccount, readAccountStorage, writeAccountStorage } from '@/auth/accountScope'
import { ApiError } from '@/services/apiClient'
import {
  getShoppingList,
  isShoppingListDocument,
  saveShoppingList,
} from '@/services/shoppingListService'
import { priceState, replacePriceState } from '@/stores/prices'
import { shoppingListState, replaceShoppingList } from '@/stores/shoppingList'
import type { ShoppingListDocument, ShoppingSnapshot } from '@/types/shoppingSync'
import {
  copyShoppingSnapshot,
  emptyShoppingSnapshot,
  mergeShoppingState,
  sameShoppingValue,
} from '@/utils/mergeShoppingState'

const storageKey = 'rezeptmanager.shopping-sync.v1'

function snapshot(): ShoppingSnapshot {
  return copyShoppingSnapshot({
    selections: shoppingListState.selections.map((item) => ({ ...item })),
    checkedKeys: [...shoppingListState.checkedKeys],
    prices: { ...priceState.prices },
    pantry: { ...priceState.pantry },
  })
}

function readBaseline(): ShoppingListDocument | null {
  try {
    const saved: unknown = JSON.parse(readAccountStorage(storageKey) ?? 'null')
    return isShoppingListDocument(saved) ? saved : null
  } catch {
    return null
  }
}

export function startShoppingSync(pollInterval = 15_000) {
  const state = reactive({ ready: false, loading: false, saving: false, pending: false, error: '' })
  let baseline: ShoppingSnapshot | null = null
  let version: number | null = null
  let generation = 0
  let stopped = false
  let applying = false
  let busy = false
  let refreshRequested = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function apply(document: ShoppingListDocument, local: ShoppingSnapshot): void {
    baseline = copyShoppingSnapshot(document.data)
    version = document.version
    applying = true
    try {
      replaceShoppingList(local)
      replacePriceState(local)
      state.pending = !sameShoppingValue(local, baseline)
      try {
        writeAccountStorage(storageKey, JSON.stringify({ version, data: baseline }))
      } catch {
        // Die Serverspeicherung funktioniert auch ohne verfügbaren Browserspeicher.
      }
    } finally {
      applying = false
    }
  }

  function schedule(): void {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void run()
    }, 350)
  }

  async function run(refresh = false): Promise<void> {
    if (refresh) refreshRequested = true
    if (stopped || !activeAccount.value || busy) return
    const owner = activeAccount.value
    const currentGeneration = generation
    const current = () =>
      !stopped && generation === currentGeneration && activeAccount.value === owner
    busy = true
    state.error = ''

    async function pull(): Promise<void> {
      refreshRequested = false
      state.loading = true
      const remote = await getShoppingList()
      if (!current()) return
      const local = snapshot()
      const next =
        remote.version === null
          ? mergeShoppingState(emptyShoppingSnapshot(), local, remote.data)
          : baseline
            ? mergeShoppingState(baseline, local, remote.data)
            : remote.data
      apply(remote, next)
    }

    try {
      if (refreshRequested || baseline === null) await pull()
      if (!current()) return

      // Versionsprüfung verhindert das Überschreiben mit einem veralteten Gesamtstand.
      for (let attempt = 0; attempt < 3; attempt++) {
        const local = snapshot()
        if (version !== null && sameShoppingValue(local, baseline)) break
        state.saving = true
        try {
          const saved = await saveShoppingList({ version, data: local })
          if (!current()) return
          apply(saved, mergeShoppingState(local, snapshot(), saved.data))
        } catch (error) {
          if (!current()) return
          if (!(error instanceof ApiError) || error.status !== 409) throw error
          await pull()
          if (!current()) return
          if (attempt === 2) throw new Error('Gleichzeitige Änderungen. Bitte erneut versuchen.')
        }
      }
    } catch {
      if (current())
        state.error =
          'Noch nicht synchronisiert. Deine Änderungen bleiben auf diesem Gerät erhalten.'
    } finally {
      if (current()) {
        busy = false
        state.ready = true
        state.loading = false
        state.saving = false
        state.pending = version === null || !sameShoppingValue(snapshot(), baseline)
        if (!state.error && (refreshRequested || !sameShoppingValue(snapshot(), baseline)))
          schedule()
      }
    }
  }

  const stopStateWatch = watch(
    () => JSON.stringify(snapshot()),
    () => {
      if (!applying && activeAccount.value) {
        state.pending = true
        schedule()
      }
    },
    { flush: 'sync' },
  )

  const stopAccountWatch = watch(
    activeAccount,
    () => {
      generation++
      if (timer) clearTimeout(timer)
      busy = false
      state.ready = false
      state.loading = false
      state.saving = false
      state.pending = false
      state.error = ''
      const saved = readBaseline()
      baseline = saved ? copyShoppingSnapshot(saved.data) : null
      version = saved?.version ?? null
      refreshRequested = true
      if (activeAccount.value) void run(true)
    },
    { immediate: true, flush: 'sync' },
  )

  const refresh = () => {
    void run(true)
  }
  const visible = () => {
    if (document.visibilityState === 'visible') refresh()
  }
  window.addEventListener('focus', refresh)
  window.addEventListener('online', refresh)
  document.addEventListener('visibilitychange', visible)
  const poll = pollInterval > 0 ? setInterval(visible, pollInterval) : undefined

  function stop(): void {
    stopped = true
    generation++
    stopStateWatch()
    stopAccountWatch()
    if (timer) clearTimeout(timer)
    if (poll) clearInterval(poll)
    window.removeEventListener('focus', refresh)
    window.removeEventListener('online', refresh)
    document.removeEventListener('visibilitychange', visible)
  }

  return { state: readonly(state), retry: () => run(true), stop }
}
