import { getJwt } from "@bytecloud/common-lib"

type ByteCloudJwtUniqueKey = "local" | "online"

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"])

export const getByteCloudJwtUniqueKey = (
  hostname = window.location.hostname,
): ByteCloudJwtUniqueKey => {
  return LOCAL_HOSTNAMES.has(hostname) ? "local" : "online"
}

export const getByteCloudJwt = async (hostname?: string): Promise<string> => {
  const jwt = await getJwt(getByteCloudJwtUniqueKey(hostname))
  if (!jwt?.trim()) throw new Error("@bytecloud/common-lib returned empty JWT")
  return jwt.trim()
}
