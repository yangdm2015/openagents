import { ConnectionStatusEnum, NetworkConnection } from "../types/connection"
import { StudioUser } from "./userAuthService"

export const HARDCODED_ADMIN_EMAIL_PREFIX = "yangshan.andy"

type BrowserLocationLike = Pick<Location, "hostname" | "port" | "protocol">

const sanitizeAgentIdPart = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export const getSingleServerNetwork = (
  locationLike: BrowserLocationLike = window.location,
): NetworkConnection => {
  const useHttps = locationLike.protocol === "https:"
  const fallbackPort = useHttps ? 443 : 80
  const parsedPort = Number.parseInt(locationLike.port || String(fallbackPort), 10)

  return {
    host: locationLike.hostname || "localhost",
    port: Number.isFinite(parsedPort) ? parsedPort : fallbackPort,
    useHttps,
    status: ConnectionStatusEnum.CONNECTED,
    networkInfo: { name: "Current OpenAgents server" },
  }
}

export const isSameNetwork = (
  left: NetworkConnection | null | undefined,
  right: NetworkConnection,
): boolean => {
  return !!left && left.host === right.host && left.port === right.port && !!left.useHttps === !!right.useHttps
}

export const getUserEmailPrefix = (user: Pick<StudioUser, "email" | "username"> | null | undefined): string => {
  const emailPrefix = user?.email?.split("@", 1)[0]
  return (emailPrefix || user?.username || "").trim().toLowerCase()
}

export const isHardcodedAdminUser = (user: Pick<StudioUser, "email" | "username"> | null | undefined): boolean => {
  return getUserEmailPrefix(user) === HARDCODED_ADMIN_EMAIL_PREFIX
}

export const deriveUserAgentName = (user: StudioUser): string => {
  const source = user.username || getUserEmailPrefix(user) || user.display_name || user.id || "user"
  const sanitized = sanitizeAgentIdPart(source) || "user"
  const agentName = sanitized.startsWith("user_") ? sanitized : `user_${sanitized}`
  return agentName.slice(0, 32)
}
