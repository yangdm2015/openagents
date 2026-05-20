import { useEffect, useState } from "react"
import { getStoredUserAuth } from "@/services/userAuthService"
import { isHardcodedAdminUser } from "@/services/singleServerSession"

interface UseIsAdminResult {
  isAdmin: boolean
  isLoading: boolean
  error: Error | null
}

export const useIsAdmin = (): UseIsAdminResult => {
  const [isAdmin, setIsAdmin] = useState(() => isHardcodedAdminUser(getStoredUserAuth()?.user))

  useEffect(() => {
    const refresh = () => setIsAdmin(isHardcodedAdminUser(getStoredUserAuth()?.user))
    refresh()
    window.addEventListener("storage", refresh)
    window.addEventListener("focus", refresh)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener("focus", refresh)
    }
  }, [])

  return { isAdmin, isLoading: false, error: null }
}
