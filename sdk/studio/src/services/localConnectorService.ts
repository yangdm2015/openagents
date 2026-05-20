export interface LocalConnectorSettings {
  url: string
  token: string
}

const LOCAL_CONNECTOR_STORAGE_KEY = "openagents-local-connector"

export const getLocalConnectorSettings = (): LocalConnectorSettings => {
  try {
    const raw = window.localStorage.getItem(LOCAL_CONNECTOR_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        url: parsed.url || "http://127.0.0.1:45555",
        token: parsed.token || "",
      }
    }
  } catch {}
  return { url: "http://127.0.0.1:45555", token: "" }
}

export const saveLocalConnectorSettings = (settings: LocalConnectorSettings): void => {
  window.localStorage.setItem(LOCAL_CONNECTOR_STORAGE_KEY, JSON.stringify(settings))
}

export const localConnectorFetch = async <T = any>(
  path: string,
  settings: LocalConnectorSettings,
  init: RequestInit = {}
): Promise<T> => {
  const baseUrl = settings.url.replace(/\/$/, "")
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.token}`,
      ...(init.headers || {}),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) {
    throw new Error(data.error || data.error_message || response.statusText)
  }
  return data as T
}
