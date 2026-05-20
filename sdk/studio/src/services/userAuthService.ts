export interface StudioUser {
  id: string
  email: string
  display_name?: string | null
  auth_provider?: string | null
  external_id?: string | null
  username?: string | null
  created_at?: number
}

export interface StoredUserAuth {
  token: string
  user: StudioUser
}

const USER_AUTH_STORAGE_KEY = "openagents-user-auth"

export const getStoredUserAuth = (): StoredUserAuth | null => {
  try {
    const raw = window.localStorage.getItem(USER_AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.token || !parsed?.user?.id) return null
    return parsed as StoredUserAuth
  } catch {
    return null
  }
}

export const getUserAuthToken = (): string | null => {
  return getStoredUserAuth()?.token || null
}

export const saveUserAuth = (auth: StoredUserAuth): void => {
  window.localStorage.setItem(USER_AUTH_STORAGE_KEY, JSON.stringify(auth))
}

export const clearUserAuth = (): void => {
  window.localStorage.removeItem(USER_AUTH_STORAGE_KEY)
}
