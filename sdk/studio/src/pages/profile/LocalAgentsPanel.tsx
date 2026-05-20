import React from "react"
import { useLocation } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import { networkFetch } from "@/utils/httpClient"
import {
  getLocalConnectorSettings,
  localConnectorFetch,
  LocalConnectorSettings,
  saveLocalConnectorSettings,
} from "@/services/localConnectorService"
import { getStoredUserAuth } from "@/services/userAuthService"
import { Button } from "@/components/layout/ui/button"
import { Input } from "@/components/layout/ui/input"
import { Label } from "@/components/layout/ui/label"
import { Bot, Cable, CirclePlus, KeyRound, Play, Square, RefreshCw } from "lucide-react"

interface UserActionRecord {
  agent_id: string
  agent_type: string
  config?: Record<string, any>
  channels?: string[]
}

interface UserChannelRecord {
  id: string
  name: string
  channel_name: string
  description?: string
}

interface LocalActionRecord {
  name: string
  runtime: string
  type?: string
  network?: string | null
  channels?: string[]
}

const LocalAgentsPanel: React.FC = () => {
  const location = useLocation()
  const selectedNetwork = useAuthStore((state) => state.selectedNetwork)
  const [actions, setActions] = React.useState<UserActionRecord[]>([])
  const [channels, setChannels] = React.useState<UserChannelRecord[]>([])
  const [localActions, setLocalActions] = React.useState<LocalActionRecord[]>([])
  const [settings, setSettings] = React.useState<LocalConnectorSettings>(() => getLocalConnectorSettings())
  const [status, setStatus] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [channelName, setChannelName] = React.useState("private")
  const [channelDescription, setChannelDescription] = React.useState("")
  const [actionName, setActionName] = React.useState("coco-one")
  const [selectedChannelIds, setSelectedChannelIds] = React.useState<string[]>([])
  const [cocoBin, setCocoBin] = React.useState("coco")
  const [cocoArgs, setCocoArgs] = React.useState("")
  const [cocoWorkdir, setCocoWorkdir] = React.useState("")

  const networkApi = React.useCallback(async <T,>(endpoint: string, init: RequestInit = {}): Promise<T> => {
    if (!selectedNetwork) throw new Error("Network is not selected")
    const response = await networkFetch(selectedNetwork.host, selectedNetwork.port, endpoint, {
      ...init,
      useHttps: selectedNetwork.useHttps,
      networkId: selectedNetwork.networkId,
    })
    const data = await response.json()
    if (!response.ok || data.success === false) {
      throw new Error(data.error_message || data.error || response.statusText)
    }
    return data as T
  }, [selectedNetwork])

  const refresh = React.useCallback(async () => {
    if (!selectedNetwork || !getStoredUserAuth()) return
    setLoading(true)
    setStatus("")
    try {
      const [actionData, channelData] = await Promise.all([
        networkApi<{ agents: UserActionRecord[] }>("/api/user/agents"),
        networkApi<{ channels: UserChannelRecord[] }>("/api/user/channels"),
      ])
      setActions(actionData.agents || [])
      setChannels(channelData.channels || [])
      if (settings.token) {
        const localData = await localConnectorFetch<{ actions: LocalActionRecord[] }>("/api/actions", settings)
        setLocalActions(localData.actions || [])
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Refresh failed")
    } finally {
      setLoading(false)
    }
  }, [networkApi, selectedNetwork, settings])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  React.useEffect(() => {
    if (!location.hash) return
    const target = document.querySelector(location.hash)
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [location.hash])

  const saveConnector = () => {
    saveLocalConnectorSettings(settings)
    setStatus("Local connector settings saved")
  }

  const createChannel = async () => {
    await networkApi("/api/user/channels", {
      method: "POST",
      body: JSON.stringify({ name: channelName, description: channelDescription }),
    })
    setChannelName("")
    setChannelDescription("")
    await refresh()
  }

  const saveProvider = async () => {
    saveConnector()
    await localConnectorFetch("/api/providers/coco", settings, {
      method: "PUT",
      body: JSON.stringify({ env: { COCO_BIN: cocoBin, COCO_ARGS: cocoArgs, COCO_WORKDIR: cocoWorkdir } }),
    })
    setStatus("Coco provider saved locally")
  }

  const createAction = async () => {
    if (!actionName.trim()) return
    const created = await networkApi<{ agent: UserActionRecord }>("/api/user/agents", {
      method: "POST",
      body: JSON.stringify({
        agent_id: actionName.trim(),
        agent_type: "coco",
        display_name: actionName.trim(),
        channel_ids: selectedChannelIds,
      }),
    })
    const tokenData = await networkApi<{ connect_token: { token: string; channels: string[] } }>(`/api/user/agents/${encodeURIComponent(created.agent.agent_id)}/connect-token`, {
      method: "POST",
    })
    if (settings.token) {
      await localConnectorFetch("/api/actions", settings, {
        method: "POST",
        body: JSON.stringify({
          name: created.agent.agent_id,
          runtime: "coco",
          path: cocoWorkdir || undefined,
          env: { COCO_BIN: cocoBin, COCO_ARGS: cocoArgs, COCO_WORKDIR: cocoWorkdir },
          network: {
            slug: "sdk-local",
            endpoint: `${selectedNetwork?.useHttps ? "https" : "http"}://${selectedNetwork?.host}:${selectedNetwork?.port}`,
            owner_connect_token: tokenData.connect_token.token,
            channels: tokenData.connect_token.channels,
          },
        }),
      })
      setStatus("Action saved to SDK network and local connector")
    } else {
      setStatus(`Action saved. Connect token: ${tokenData.connect_token.token}`)
    }
    await refresh()
  }

  const actionCommand = async (name: string, action: "start" | "stop") => {
    await localConnectorFetch(`/api/actions/${encodeURIComponent(name)}/${action}`, settings, { method: "POST" })
    setStatus(`${action} sent for ${name}`)
  }

  const toggleChannel = (id: string) => {
    setSelectedChannelIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  return (
    <div className="p-6 dark:bg-zinc-950 h-full min-h-screen overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Agents & Channels</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create local agents, configure local providers, and manage private channels.</p>
        </div>
        <Button onClick={refresh} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {status && <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">{status}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100"><Cable className="h-4 w-4" /> Local connector</div>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input value={settings.url} onChange={(event) => setSettings({ ...settings, url: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Pairing token</Label>
            <Input value={settings.token} onChange={(event) => setSettings({ ...settings, token: event.target.value })} type="password" />
          </div>
          <Button onClick={saveConnector} className="w-full">Save connector</Button>
        </section>

        <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100"><KeyRound className="h-4 w-4" /> Coco runtime</div>
          <div className="space-y-2"><Label>COCO_BIN</Label><Input value={cocoBin} onChange={(event) => setCocoBin(event.target.value)} /></div>
          <div className="space-y-2"><Label>COCO_ARGS</Label><Input value={cocoArgs} onChange={(event) => setCocoArgs(event.target.value)} /></div>
          <div className="space-y-2"><Label>COCO_WORKDIR</Label><Input value={cocoWorkdir} onChange={(event) => setCocoWorkdir(event.target.value)} /></div>
          <Button onClick={saveProvider} className="w-full">Save locally</Button>
        </section>

        <section id="create-channel" className="scroll-mt-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100"><CirclePlus className="h-4 w-4" /> Create Channel</div>
          <div className="space-y-2"><Label>Name</Label><Input value={channelName} onChange={(event) => setChannelName(event.target.value)} /></div>
          <div className="space-y-2"><Label>Description</Label><Input value={channelDescription} onChange={(event) => setChannelDescription(event.target.value)} /></div>
          <Button onClick={createChannel} className="w-full">Create private channel</Button>
          <div className="space-y-2 text-sm">
            {channels.map((channel) => <div key={channel.id} className="rounded border border-gray-200 dark:border-gray-800 p-2"><div className="font-medium">{channel.name}</div><div className="text-gray-500">{channel.channel_name}</div></div>)}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
        <section id="create-agent" className="scroll-mt-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100"><Bot className="h-4 w-4" /> Create Agent</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Action name</Label><Input value={actionName} onChange={(event) => setActionName(event.target.value)} /></div>
            <div className="space-y-2"><Label>Runtime</Label><Input value="coco" disabled /></div>
          </div>
          <div className="space-y-2">
            <Label>Bind private channels</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {channels.map((channel) => (
                <label key={channel.id} className="flex items-center gap-2 text-sm rounded border border-gray-200 dark:border-gray-800 p-2">
                  <input type="checkbox" checked={selectedChannelIds.includes(channel.id)} onChange={() => toggleChannel(channel.id)} />
                  <span>{channel.name}</span>
                </label>
              ))}
            </div>
          </div>
          <Button onClick={createAction}>Create agent</Button>
          <div className="space-y-2">
            {actions.map((action) => <div key={action.agent_id} className="rounded border border-gray-200 dark:border-gray-800 p-3"><div className="font-medium">{action.agent_id}</div><div className="text-sm text-gray-500">{action.agent_type}</div></div>)}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4">
          <div className="font-semibold text-gray-900 dark:text-gray-100">Local connector actions</div>
          {localActions.map((action) => (
            <div key={action.name} className="flex items-center justify-between rounded border border-gray-200 dark:border-gray-800 p-3">
              <div><div className="font-medium">{action.name}</div><div className="text-sm text-gray-500">{action.runtime || action.type || "coco"} / {action.network || "local"}</div></div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => actionCommand(action.name, "start")}><Play className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => actionCommand(action.name, "stop")}><Square className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

export default LocalAgentsPanel
