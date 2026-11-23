import { readonly, ref } from 'vue'

const account = ref<string | null>(null)
const notice = ref('')

export const activeAccount = readonly(account)
export const authNotice = readonly(notice)

export function setActiveAccount(subject: string | null): void {
  const next = subject && !/\s/.test(subject) && subject.length <= 255 ? subject : null

  if (account.value === next) return

  notice.value = ''
  account.value = next
}

export function invalidateAccount(subject: string, message: string): void {
  if (account.value !== subject) return

  setActiveAccount(null)
  notice.value = message
}

export function accountStorageKey(baseKey: string): string | null {
  return account.value ? `${baseKey}:${encodeURIComponent(account.value)}` : null
}

export function readAccountStorage(baseKey: string): string | null {
  const key = accountStorageKey(baseKey)

  if (!key) return null

  const saved = localStorage.getItem(key)

  if (saved !== null) return saved

  if (account.value !== import.meta.env.VITE_LEGACY_OWNER_SUBJECT) return null

  const legacy = localStorage.getItem(baseKey)

  if (legacy !== null) {
    try {
      localStorage.setItem(key, legacy)
      localStorage.removeItem(baseKey)
    } catch {
      // Die bisherigen Daten bleiben auch bei gesperrtem Speicher erhalten.
    }
  }

  return legacy
}

export function writeAccountStorage(baseKey: string, value: string): void {
  const key = accountStorageKey(baseKey)

  if (key) localStorage.setItem(key, value)
}
