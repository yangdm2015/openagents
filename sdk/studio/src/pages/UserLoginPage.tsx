import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import { networkFetch } from "@/utils/httpClient"
import {
  clearUserAuth,
  getStoredUserAuth,
  saveUserAuth,
  StudioUser,
} from "@/services/userAuthService"
import { getByteCloudJwt } from "@/services/bytecloudJwtService"
import {
  deriveUserAgentName,
  getSingleServerNetwork,
  isSameNetwork,
} from "@/services/singleServerSession"
import { Button } from "@/components/layout/ui/button"
import { KeyRound, Loader2 } from "lucide-react"

const UserLoginPage: React.FC = () => {
  const navigate = useNavigate()
  const serverNetwork = useMemo(() => getSingleServerNetwork(), [])
  const {
    selectedNetwork,
    handleNetworkSelected,
    setAgentName,
    setAgentGroup,
    setPasswordHash,
  } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isSameNetwork(selectedNetwork, serverNetwork)) {
      handleNetworkSelected(serverNetwork)
    }
  }, [handleNetworkSelected, selectedNetwork, serverNetwork])

  const completeUserSession = useCallback(
    (token: string, user: StudioUser) => {
      saveUserAuth({ token, user })
      handleNetworkSelected(serverNetwork)
      setAgentName(deriveUserAgentName(user))
      setAgentGroup("guest")
      setPasswordHash(null)
      navigate("/user-dashboard", { replace: true })
    },
    [handleNetworkSelected, navigate, serverNetwork, setAgentGroup, setAgentName, setPasswordHash],
  )

  useEffect(() => {
    const stored = getStoredUserAuth()
    if (!stored?.token) return

    networkFetch(serverNetwork.host, serverNetwork.port, "/api/auth/me", {
      method: "GET",
      useHttps: serverNetwork.useHttps,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("expired")
        return response.json()
      })
      .then((data) => {
        if (data.success && data.user) {
          completeUserSession(stored.token, data.user as StudioUser)
        }
      })
      .catch(() => clearUserAuth())
  }, [completeUserSession, serverNetwork])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    try {
      const token = await getByteCloudJwt()
      const response = await networkFetch(serverNetwork.host, serverNetwork.port, "/api/auth/bytedance-jwt", {
        method: "POST",
        headers: { "X-Jwt-Token": token },
        body: JSON.stringify({ jwt: token }),
        useHttps: serverNetwork.useHttps,
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error_message || "ByteDance SSO failed")
      }
      clearUserAuth()
      completeUserSession(data.token, data.user as StudioUser)
    } catch (e) {
      setError(e instanceof Error ? e.message : "ByteDance SSO failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-zinc-950 p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">ByteDance SSO</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {serverNetwork.host}:{serverNetwork.port}
          </p>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          Sign in to this OpenAgents server with your ByteDance SSO session.
        </p>

        {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
          Sign in with ByteDance
        </Button>
      </form>
    </div>
  )
}

export default UserLoginPage
