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
import { Bot, Cable, CirclePlus, Hash, KeyRound, Play, RefreshCw, Square, Users } from "lucide-react"

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

type RuntimeConfig = {
  reasoning_effort?: string
  verbosity?: string
  max_turns?: string
  bin?: string
  args?: string
  workdir?: string
}

interface LocalActionRecord {
  name: string
  runtime: string
  type?: string
  model?: string | null
  description?: string
  runtime_config?: RuntimeConfig
  network?: string | null
  channels?: string[]
}

type RuntimeKind = "codex" | "claude" | "coco"
type ActivePanel = "agents" | "channels"

const RUNTIME_OPTIONS: Array<{ value: RuntimeKind; label: string }> = [
  { value: "codex", label: "Codex" },
  { value: "claude", label: "Claude" },
  { value: "coco", label: "Coco" },
]

const RUNTIME_MODELS: Record<RuntimeKind, string[]> = {
  codex: ["gpt-5.1-codex", "gpt-5.1-codex-max", "gpt-5.1", "gpt-5", "gpt-4.1"],
  claude: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-haiku-4-5"],
  coco: ["coco-default"],
}

const CODEX_REASONING_EFFORTS = ["minimal", "low", "medium", "high", "xhigh"]
const CODEX_VERBOSITY_OPTIONS = ["low", "medium", "high"]

const selectClassName = "flex h-10 w-full border-2 border-zinc-900 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-yellow-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
const paneClassName = "min-h-0 border-zinc-900 bg-white dark:border-zinc-700 dark:bg-zinc-950"

const runtimeLabel = (runtime?: string) => {
  const option = RUNTIME_OPTIONS.find((item) => item.value === runtime)
  return option?.label || runtime || "Coco"
}

const agentTitle = (agent?: UserActionRecord) => {
  if (!agent) return "No agent selected"
  return agent.config?.display_name || agent.agent_id
}

const agentRuntime = (agent?: UserActionRecord) => {
  if (!agent) return ""
  return agent.config?.runtime || agent.agent_type
}

const formatRuntimeConfig = (config?: RuntimeConfig | Record<string, any>) => {
  const entries = Object.entries(config || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
  if (entries.length === 0) return ""
  return entries.map(([key, value]) => `${key}: ${value}`).join(" / ")
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
  const [activePanel, setActivePanel] = React.useState<ActivePanel>("agents")
  const [selectedAgentId, setSelectedAgentId] = React.useState("")
  const [selectedChannelId, setSelectedChannelId] = React.useState("")
  const [channelName, setChannelName] = React.useState("private")
  const [channelDescription, setChannelDescription] = React.useState("")
  const [actionName, setActionName] = React.useState("my-agent")
  const [actionDescription, setActionDescription] = React.useState("")
  const [selectedRuntime, setSelectedRuntime] = React.useState<RuntimeKind>("codex")
  const [selectedModel, setSelectedModel] = React.useState(RUNTIME_MODELS.codex[0])
  const [codexReasoningEffort, setCodexReasoningEffort] = React.useState("medium")
  const [codexVerbosity, setCodexVerbosity] = React.useState("medium")
  const [claudeMaxTurns, setClaudeMaxTurns] = React.useState("")
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
      } else {
        setLocalActions([])
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
    const models = RUNTIME_MODELS[selectedRuntime]
    if (!models.includes(selectedModel)) {
      setSelectedModel(models[0])
    }
  }, [selectedRuntime, selectedModel])

  React.useEffect(() => {
    if (actions.length === 0) {
      setSelectedAgentId("")
      return
    }
    if (!selectedAgentId || !actions.some((action) => action.agent_id === selectedAgentId)) {
      setSelectedAgentId(actions[0].agent_id)
    }
  }, [actions, selectedAgentId])

  React.useEffect(() => {
    if (channels.length === 0) {
      setSelectedChannelId("")
      return
    }
    if (!selectedChannelId || !channels.some((channel) => channel.id === selectedChannelId)) {
      setSelectedChannelId(channels[0].id)
    }
  }, [channels, selectedChannelId])

  React.useEffect(() => {
    if (!location.hash) return
    if (location.hash === "#create-channel") setActivePanel("channels")
    if (location.hash === "#create-agent") setActivePanel("agents")
    const target = document.querySelector(location.hash)
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [location.hash])

  const selectedAgent = React.useMemo(
    () => actions.find((action) => action.agent_id === selectedAgentId) || actions[0],
    [actions, selectedAgentId]
  )

  const selectedChannel = React.useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) || channels[0],
    [channels, selectedChannelId]
  )

  const selectedLocalAction = React.useMemo(
    () => localActions.find((action) => action.name === selectedAgent?.agent_id),
    [localActions, selectedAgent]
  )

  const saveConnector = () => {
    saveLocalConnectorSettings(settings)
    setStatus("Local connector settings saved")
  }

  const createChannel = async () => {
    if (!channelName.trim()) return
    await networkApi("/api/user/channels", {
      method: "POST",
      body: JSON.stringify({ name: channelName.trim(), description: channelDescription.trim() }),
    })
    setChannelName("")
    setChannelDescription("")
    setActivePanel("channels")
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

  const buildRuntimeConfig = (): RuntimeConfig => {
    if (selectedRuntime === "codex") {
      return { reasoning_effort: codexReasoningEffort, verbosity: codexVerbosity }
    }
    if (selectedRuntime === "claude") {
      return claudeMaxTurns.trim() ? { max_turns: claudeMaxTurns.trim() } : {}
    }
    return {
      bin: cocoBin.trim() || "coco",
      ...(cocoArgs.trim() ? { args: cocoArgs.trim() } : {}),
      ...(cocoWorkdir.trim() ? { workdir: cocoWorkdir.trim() } : {}),
    }
  }

  const createAction = async () => {
    if (!actionName.trim()) return
    const displayName = actionName.trim()
    const description = actionDescription.trim()
    const runtimeConfig = buildRuntimeConfig()
    const created = await networkApi<{ agent: UserActionRecord }>("/api/user/agents", {
      method: "POST",
      body: JSON.stringify({
        agent_id: displayName,
        agent_type: selectedRuntime,
        display_name: displayName,
        runtime_config: runtimeConfig,
        config: {
          display_name: displayName,
          description,
          runtime: selectedRuntime,
          model: selectedModel,
          runtime_config: runtimeConfig,
        },
        channel_ids: selectedChannelIds,
      }),
    })
    const tokenData = await networkApi<{ connect_token: { token: string; channels: string[] } }>(`/api/user/agents/${encodeURIComponent(created.agent.agent_id)}/connect-token`, {
      method: "POST",
    })
    if (settings.token) {
      const runtimeEnv = selectedRuntime === "coco"
        ? { COCO_BIN: cocoBin, COCO_ARGS: cocoArgs, COCO_WORKDIR: cocoWorkdir }
        : {}
      await localConnectorFetch("/api/actions", settings, {
        method: "POST",
        body: JSON.stringify({
          name: created.agent.agent_id,
          runtime: selectedRuntime,
          model: selectedModel,
          description,
          runtime_config: runtimeConfig,
          path: selectedRuntime === "coco" ? (cocoWorkdir || undefined) : undefined,
          env: runtimeEnv,
          network: {
            slug: "sdk-local",
            endpoint: `${selectedNetwork?.useHttps ? "https" : "http"}://${selectedNetwork?.host}:${selectedNetwork?.port}`,
            owner_connect_token: tokenData.connect_token.token,
            channels: tokenData.connect_token.channels,
          },
        }),
      })
      setStatus("Agent saved to SDK network and local connector")
    } else {
      setStatus(`Agent saved. Connect token: ${tokenData.connect_token.token}`)
    }
    setActionName("")
    setActionDescription("")
    setSelectedAgentId(created.agent.agent_id)
    setActivePanel("agents")
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
    <div className="h-full min-h-0 overflow-hidden bg-[#f7f2e8] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_380px]">
        <aside className={`${paneClassName} flex min-h-[220px] flex-col border-b-2 xl:border-b-0 xl:border-r-2`}>
          <div className="flex h-16 items-center justify-between border-b-2 border-zinc-900 px-5 dark:border-zinc-700">
            <div className="flex items-center gap-2 text-lg font-bold">
              <Users className="h-5 w-5" />
              Agents
            </div>
            <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#fff9ed] p-4 dark:bg-zinc-950">
            <div className="mb-5">
              <button
                type="button"
                onClick={() => setActivePanel("channels")}
                className={`mb-2 flex w-full items-center justify-between border-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide ${
                  activePanel === "channels"
                    ? "border-zinc-900 bg-[#f472a5] text-zinc-950"
                    : "border-transparent text-zinc-600 hover:border-zinc-900 dark:text-zinc-300"
                }`}
              >
                <span className="flex items-center gap-2"><Hash className="h-4 w-4" /> Channels</span>
                <span>{channels.length}</span>
              </button>
              <div className="space-y-1">
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => {
                      setSelectedChannelId(channel.id)
                      setActivePanel("channels")
                    }}
                    className={`w-full border px-3 py-2 text-left text-sm ${
                      selectedChannel?.id === channel.id && activePanel === "channels"
                        ? "border-zinc-900 bg-white font-semibold shadow-[3px_3px_0_0_#111827] dark:bg-zinc-900"
                        : "border-transparent hover:border-zinc-300"
                    }`}
                  >
                    <div className="truncate"># {channel.name}</div>
                    <div className="truncate text-xs text-zinc-500">{channel.channel_name}</div>
                  </button>
                ))}
                {channels.length === 0 && <div className="px-3 py-2 text-sm text-zinc-500">No channels</div>}
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setActivePanel("agents")}
                className={`mb-2 flex w-full items-center justify-between border-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide ${
                  activePanel === "agents"
                    ? "border-zinc-900 bg-[#f472a5] text-zinc-950"
                    : "border-transparent text-zinc-600 hover:border-zinc-900 dark:text-zinc-300"
                }`}
              >
                <span className="flex items-center gap-2"><Bot className="h-4 w-4" /> Agents</span>
                <span>{actions.length}</span>
              </button>
              <div className="space-y-1">
                {actions.map((action) => {
                  const local = localActions.find((item) => item.name === action.agent_id)
                  return (
                    <button
                      key={action.agent_id}
                      type="button"
                      onClick={() => {
                        setSelectedAgentId(action.agent_id)
                        setActivePanel("agents")
                      }}
                      className={`w-full border px-3 py-2 text-left text-sm ${
                        selectedAgent?.agent_id === action.agent_id && activePanel === "agents"
                          ? "border-zinc-900 bg-white font-semibold shadow-[3px_3px_0_0_#111827] dark:bg-zinc-900"
                          : "border-transparent hover:border-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${local ? "bg-green-500" : "bg-zinc-300"}`} />
                        <span className="min-w-0 flex-1 truncate">{agentTitle(action)}</span>
                      </div>
                      <div className="truncate pl-4 text-xs text-zinc-500">
                        {runtimeLabel(agentRuntime(action))}
                        {action.config?.model ? ` / ${action.config.model}` : ""}
                      </div>
                    </button>
                  )
                })}
                {actions.length === 0 && <div className="px-3 py-2 text-sm text-zinc-500">No agents</div>}
              </div>
            </div>
          </div>
        </aside>

        <main className={`${paneClassName} min-h-0 overflow-y-auto border-b-2 xl:border-b-0 xl:border-r-2`}>
          <div className="flex h-16 items-center justify-between border-b-2 border-zinc-900 px-6 dark:border-zinc-700">
            <div>
              <div className="text-xl font-bold">{activePanel === "agents" ? "Agent Management" : "Channel Management"}</div>
              <div className="text-xs text-zinc-500">{selectedNetwork ? `${selectedNetwork.host}:${selectedNetwork.port}` : "No network selected"}</div>
            </div>
            <div className="flex gap-2">
              <Button variant={activePanel === "agents" ? "primary" : "outline"} onClick={() => setActivePanel("agents")}>Agents</Button>
              <Button variant={activePanel === "channels" ? "primary" : "outline"} onClick={() => setActivePanel("channels")}>Channels</Button>
            </div>
          </div>

          {status && (
            <div className="border-b-2 border-zinc-900 bg-yellow-100 px-6 py-3 text-sm font-medium text-zinc-950 dark:border-zinc-700">
              {status}
            </div>
          )}

          {activePanel === "agents" ? (
            <div className="grid gap-6 p-6 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
              <section id="create-agent" className="space-y-5">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
                  <CirclePlus className="h-4 w-4" />
                  Create Agent
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={actionName} onChange={(event) => setActionName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={actionDescription} onChange={(event) => setActionDescription(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Runtime</Label>
                    <select className={selectClassName} value={selectedRuntime} onChange={(event) => setSelectedRuntime(event.target.value as RuntimeKind)}>
                      {RUNTIME_OPTIONS.map((runtime) => <option key={runtime.value} value={runtime.value}>{runtime.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <select className={selectClassName} value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
                      {RUNTIME_MODELS[selectedRuntime].map((model) => <option key={model} value={model}>{model}</option>)}
                    </select>
                  </div>
                  {selectedRuntime === "codex" && (
                    <>
                      <div className="space-y-2">
                        <Label>Reasoning effort</Label>
                        <select className={selectClassName} value={codexReasoningEffort} onChange={(event) => setCodexReasoningEffort(event.target.value)}>
                          {CODEX_REASONING_EFFORTS.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Verbosity</Label>
                        <select className={selectClassName} value={codexVerbosity} onChange={(event) => setCodexVerbosity(event.target.value)}>
                          {CODEX_VERBOSITY_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  {selectedRuntime === "claude" && (
                    <div className="space-y-2">
                      <Label>Max turns</Label>
                      <Input value={claudeMaxTurns} onChange={(event) => setClaudeMaxTurns(event.target.value)} />
                    </div>
                  )}
                  {selectedRuntime === "coco" && (
                    <>
                      <div className="space-y-2">
                        <Label>COCO_BIN</Label>
                        <Input value={cocoBin} onChange={(event) => setCocoBin(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>COCO_ARGS</Label>
                        <Input value={cocoArgs} onChange={(event) => setCocoArgs(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>COCO_WORKDIR</Label>
                        <Input value={cocoWorkdir} onChange={(event) => setCocoWorkdir(event.target.value)} />
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Bind channels</Label>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {channels.map((channel) => (
                      <label key={channel.id} className="flex min-h-10 items-center gap-2 border-2 border-zinc-900 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                        <input type="checkbox" checked={selectedChannelIds.includes(channel.id)} onChange={() => toggleChannel(channel.id)} />
                        <span className="truncate"># {channel.name}</span>
                      </label>
                    ))}
                    {channels.length === 0 && <div className="text-sm text-zinc-500">No channels yet</div>}
                  </div>
                </div>

                <Button onClick={createAction}>Create agent</Button>
              </section>

              <section className="border-2 border-zinc-900 bg-[#fff9ed] p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="mb-4 text-sm font-bold uppercase tracking-wide text-zinc-500">Selected Agent</div>
                {selectedAgent ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-lg font-bold">{agentTitle(selectedAgent)}</div>
                      <div className="text-sm text-zinc-500">{runtimeLabel(agentRuntime(selectedAgent))}{selectedAgent.config?.model ? ` / ${selectedAgent.config.model}` : ""}</div>
                    </div>
                    {selectedAgent.config?.description && <div className="text-sm">{selectedAgent.config.description}</div>}
                    {formatRuntimeConfig(selectedAgent.config?.runtime_config) && <div className="text-xs text-zinc-500">{formatRuntimeConfig(selectedAgent.config?.runtime_config)}</div>}
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Channels</div>
                    <div className="flex flex-wrap gap-2">
                      {(selectedAgent.channels || []).map((channel) => (
                        <span key={channel} className="border border-zinc-900 px-2 py-1 text-xs dark:border-zinc-700"># {channel}</span>
                      ))}
                      {(!selectedAgent.channels || selectedAgent.channels.length === 0) && <span className="text-sm text-zinc-500">None</span>}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500">No agent selected</div>
                )}
              </section>
            </div>
          ) : (
            <div className="grid gap-6 p-6 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
              <section id="create-channel" className="space-y-5">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
                  <CirclePlus className="h-4 w-4" />
                  Create Channel
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={channelName} onChange={(event) => setChannelName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={channelDescription} onChange={(event) => setChannelDescription(event.target.value)} />
                  </div>
                </div>
                <Button onClick={createChannel}>Create channel</Button>
              </section>

              <section className="border-2 border-zinc-900 bg-[#fff9ed] p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="mb-4 text-sm font-bold uppercase tracking-wide text-zinc-500">Selected Channel</div>
                {selectedChannel ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-lg font-bold"># {selectedChannel.name}</div>
                      <div className="text-sm text-zinc-500">{selectedChannel.channel_name}</div>
                    </div>
                    {selectedChannel.description && <div className="text-sm">{selectedChannel.description}</div>}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500">No channel selected</div>
                )}
              </section>
            </div>
          )}
        </main>

        <aside className={`${paneClassName} min-h-0 overflow-y-auto`}>
          <div className="flex h-16 items-center gap-2 border-b-2 border-zinc-900 px-5 text-lg font-bold dark:border-zinc-700">
            <Cable className="h-5 w-5" />
            Runtime
          </div>
          <div className="space-y-6 p-5">
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
                <Cable className="h-4 w-4" />
                Local connector
              </div>
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

            <section className="space-y-3 border-t-2 border-zinc-900 pt-5 dark:border-zinc-700">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
                <KeyRound className="h-4 w-4" />
                Coco runtime
              </div>
              <div className="space-y-2">
                <Label>COCO_BIN</Label>
                <Input value={cocoBin} onChange={(event) => setCocoBin(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>COCO_ARGS</Label>
                <Input value={cocoArgs} onChange={(event) => setCocoArgs(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>COCO_WORKDIR</Label>
                <Input value={cocoWorkdir} onChange={(event) => setCocoWorkdir(event.target.value)} />
              </div>
              <Button onClick={saveProvider} className="w-full">Save runtime</Button>
            </section>

            <section className="space-y-3 border-t-2 border-zinc-900 pt-5 dark:border-zinc-700">
              <div className="text-sm font-bold uppercase tracking-wide text-zinc-500">Local action</div>
              {selectedLocalAction ? (
                <div className="space-y-3">
                  <div>
                    <div className="font-semibold">{selectedLocalAction.name}</div>
                    <div className="text-sm text-zinc-500">
                      {runtimeLabel(selectedLocalAction.runtime || selectedLocalAction.type)}
                      {selectedLocalAction.model ? ` / ${selectedLocalAction.model}` : ""}
                    </div>
                    {selectedLocalAction.description && <div className="mt-1 text-sm">{selectedLocalAction.description}</div>}
                    {formatRuntimeConfig(selectedLocalAction.runtime_config) && <div className="mt-1 text-xs text-zinc-500">{formatRuntimeConfig(selectedLocalAction.runtime_config)}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => actionCommand(selectedLocalAction.name, "start")}><Play className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => actionCommand(selectedLocalAction.name, "stop")}><Square className="h-4 w-4" /></Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-zinc-500">No local action selected</div>
              )}
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default LocalAgentsPanel
