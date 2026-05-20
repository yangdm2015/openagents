import React, { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import { routes } from "./routeConfig"
import { useDynamicRoutes } from "@/hooks/useDynamicRoutes"
import { isRouteAvailable } from "@/utils/moduleUtils"
import { getStoredUserAuth, getUserAuthToken } from "@/services/userAuthService"
import { isHardcodedAdminUser } from "@/services/singleServerSession"

interface RouteGuardProps {
  children: React.ReactNode
}

const loadingView = (label = "Loading...") => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">{label}</p>
    </div>
  </div>
)

/**
 * Single-server route guard.
 * Users enter through ByteDance SSO and are automatically attached to the current server.
 */
const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const location = useLocation()
  const { selectedNetwork, agentName } = useAuthStore()
  const { isModulesLoaded, defaultRoute, enabledModules } = useDynamicRoutes()
  const currentPath = location.pathname
  const hasUserSession = !!getUserAuthToken()
  const storedUser = getStoredUserAuth()?.user
  const [moduleLoadTimeout, setModuleLoadTimeout] = useState(false)

  useEffect(() => {
    if (selectedNetwork && agentName && !isModulesLoaded && !moduleLoadTimeout) {
      const timeoutId = setTimeout(() => {
        console.warn("Module loading timeout after 15 seconds, allowing navigation to continue")
        setModuleLoadTimeout(true)
      }, 15000)
      return () => clearTimeout(timeoutId)
    }
    setModuleLoadTimeout(false)
  }, [selectedNetwork, agentName, isModulesLoaded, moduleLoadTimeout])

  if (currentPath === "/user-login") {
    return <>{children}</>
  }

  if (!hasUserSession) {
    return <Navigate to="/user-login" replace />
  }

  if (currentPath === "/" || currentPath === "/network-selection" || currentPath === "/onboarding") {
    if (!selectedNetwork || !agentName) {
      return <Navigate to="/user-login" replace />
    }
    if (!isModulesLoaded && !moduleLoadTimeout) {
      return loadingView()
    }
    return <Navigate to="/user-dashboard" replace />
  }

  if (currentPath === "/agent-setup") {
    return <Navigate to={selectedNetwork && agentName ? "/user-dashboard" : "/user-login"} replace />
  }

  if (currentPath === "/admin-login") {
    return <Navigate to={isHardcodedAdminUser(storedUser) ? "/admin/dashboard" : "/user-dashboard"} replace />
  }

  const isAuthenticatedRoute = routes.some((route) => {
    if (!route.requiresAuth) return false

    const routePath = route.path
    if (routePath.endsWith("/*")) {
      const basePath = routePath.slice(0, -2)
      return currentPath === basePath || currentPath.startsWith(`${basePath}/`)
    }
    if (routePath.includes(":")) {
      const basePath = routePath.split("/:")[0]
      return currentPath === basePath || currentPath.startsWith(`${basePath}/`)
    }
    return currentPath === routePath
  })

  if (isAuthenticatedRoute) {
    if (!selectedNetwork || !agentName) {
      return <Navigate to="/user-login" replace />
    }

    const isProjectRoute = currentPath.startsWith("/project")
    const isAdminRoute = currentPath.startsWith("/admin")
    const isUserDashboardRoute = currentPath.startsWith("/user-dashboard")

    if (
      isModulesLoaded &&
      !isProjectRoute &&
      !isAdminRoute &&
      !isUserDashboardRoute &&
      !isRouteAvailable(currentPath, enabledModules)
    ) {
      return <Navigate to={defaultRoute} replace />
    }

    return <>{children}</>
  }

  if (currentPath.startsWith("/admin")) {
    return <>{children}</>
  }

  return <Navigate to={selectedNetwork && agentName ? "/user-dashboard" : "/user-login"} replace />
}

export default RouteGuard
