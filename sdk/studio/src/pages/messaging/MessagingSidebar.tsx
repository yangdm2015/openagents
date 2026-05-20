import React from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { ThreadChannel, AgentInfo } from "@/types/events";
import { useOpenAgents } from "@/context/OpenAgentsProvider";
import { useChatStore, setChatStoreContext } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { networkFetch } from "@/utils/httpClient";
import { CirclePlus } from "lucide-react";

// Section Header Component
const SectionHeader: React.FC<{ title: string }> = React.memo(({ title }) => (
  <div className="px-5 my-3">
    <div className="flex items-center">
      <div className="text-xs font-bold text-gray-400 tracking-wide select-none">
        {title}
      </div>
      <div className="ml-2 h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
    </div>
  </div>
));
SectionHeader.displayName = "SectionHeader";

const getChannelDisplayName = (channel: ThreadChannel) =>
  channel.display_name || channel.name;

// Channel List Item Component
const ChannelItem: React.FC<{
  channel: ThreadChannel;
  isActive: boolean;
  unreadCount: number;
  onClick: () => void;
}> = React.memo(({ channel, isActive, unreadCount, onClick }) => {
  const displayName = getChannelDisplayName(channel);
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full text-left text-sm truncate px-2 py-2 font-medium rounded transition-colors
        ${isActive
          ? "bg-[#F4F4F5] text-gray-900 dark:bg-[#F4F4F5] dark:text-gray-900 pl-2"
          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-900 pl-2.5"
        }
      `}
        title={channel.description || displayName}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <span className="mr-2 text-gray-400">#</span>
            <span className="truncate">{displayName}</span>
          </div>
          {unreadCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </button>
    </li>
  );
});
ChannelItem.displayName = "ChannelItem";

// Agent List Item Component
const AgentItem: React.FC<{
  agent: AgentInfo;
  isActive: boolean;
  unreadCount: number;
  onClick: () => void;
}> = React.memo(({ agent, isActive, unreadCount, onClick }) => (
  <li>
    <button
      onClick={onClick}
      className={`w-full text-left text-sm truncate px-2 py-2 font-medium rounded transition-colors
        ${isActive
          ? "bg-[#F4F4F5] text-gray-900 dark:bg-[#F4F4F5] dark:text-gray-900 pl-2"
          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-900 pl-2.5"
        }
      `}
      title={agent.metadata?.display_name || agent.agent_id}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0">
          <div
            className={`w-2 h-2 rounded-full mr-2 ${agent.metadata?.status === "online"
              ? "bg-green-500"
              : "bg-gray-400"
              }`}
          />
          <span className="truncate">
            {agent.metadata?.display_name || agent.agent_id}
          </span>
        </div>
        {unreadCount > 0 && (
          <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
    </button>
  </li>
));
AgentItem.displayName = "AgentItem";

interface UserAgentRecord {
  agent_id: string;
  agent_type: string;
  config?: {
    display_name?: string;
    runtime?: string;
  };
}

const userAgentTitle = (agent: UserAgentRecord) =>
  agent.config?.display_name || agent.agent_id;

const userAgentRuntime = (agent: UserAgentRecord) =>
  agent.config?.runtime || agent.agent_type;

// Chat Sidebar Content Component - Use chatStore to get data
const MessagingSidebar: React.FC = () => {
  const { t } = useTranslation('messaging');
  const location = useLocation();
  const { connector, connectionStatus, isConnected } = useOpenAgents();
  const { agentName, selectedNetwork } = useAuthStore();
  const [isCreateChannelOpen, setIsCreateChannelOpen] = React.useState(false);
  const [channelName, setChannelName] = React.useState("private");
  const [channelDescription, setChannelDescription] = React.useState("");
  const [channelStatus, setChannelStatus] = React.useState("");
  const [isCreatingChannel, setIsCreatingChannel] = React.useState(false);
  const [userAgents, setUserAgents] = React.useState<UserAgentRecord[]>([]);
  const [userAgentsLoading, setUserAgentsLoading] = React.useState(false);
  const [selectedChannelAgentIds, setSelectedChannelAgentIds] = React.useState<string[]>([]);
  const [primaryChannelAgentId, setPrimaryChannelAgentId] = React.useState("");

  // Set chatStore context reference
  React.useEffect(() => {
    setChatStoreContext({ connector, connectionStatus, isConnected });
  }, [connector, connectionStatus, isConnected]);

  // Use agentName as fallback if connectionStatus.agentId is unavailable
  const currentUserId = ('agentId' in connectionStatus ? connectionStatus.agentId : undefined) || agentName || undefined;

  // Use chatStore to get data and selection state
  const {
    currentChannel,
    currentDirectMessage,
    currentAgentConversation,
    selectChannel,
    selectDirectMessage,
    selectAgentConversation,
    channels,
    channelsLoading,
    channelsLoaded,
    agents,
    agentsLoading,
    agentsLoaded,
    agentConversations,
    agentConversationsLoaded,
    loadChannels,
    loadAgents,
    loadAgentConversations,
    restorePersistedSelection,
    initializeWithDefaultSelection,
  } = useChatStore();

  // Load initial data - only call when not loaded
  React.useEffect(() => {
    if (isConnected) {
      if (!channelsLoaded && !channelsLoading) {
        console.log('MessagingSidebar: Loading channels...');
        loadChannels();
      }
      if (!agentsLoaded && !agentsLoading) {
        console.log('MessagingSidebar: Loading agents...');
        loadAgents();
      }
      if (!agentConversationsLoaded) {
        loadAgentConversations();
      }
    }
  }, [isConnected, channelsLoaded, channelsLoading, agentsLoaded, agentsLoading, agentConversationsLoaded, loadChannels, loadAgents, loadAgentConversations]);

  // Handle selection restoration and default selection - execute after data loading completes
  React.useEffect(() => {
    const handleSelectionInitialization = async () => {
      // Check if there is already a selection (may be restored from persistence)
      if (currentChannel || currentDirectMessage) {
        console.log('MessagingSidebar: Already has selection, skipping initialization');
        return;
      }

      // Only execute initialization when both are loaded
      if (!channelsLoaded || !agentsLoaded) {
        console.log('MessagingSidebar: Waiting for data to load before selection initialization');
        return;
      }

      console.log('MessagingSidebar: Data loaded, attempting selection restoration/initialization');

      try {
        // Try to restore persisted selection
        await restorePersistedSelection();

        // If still no selection after restoration, use default selection
        // Need to check again, because restorePersistedSelection may set selection
        const state = useChatStore.getState();
        if (!state.currentChannel && !state.currentDirectMessage) {
          console.log('MessagingSidebar: No persisted selection restored, using default selection');
          await initializeWithDefaultSelection();
        }
      } catch (error) {
        console.error('MessagingSidebar: Error during selection initialization:', error);
        // If error occurs, use default selection
        await initializeWithDefaultSelection();
      }
    };

    handleSelectionInitialization();
  }, [channelsLoaded, agentsLoaded, currentChannel, currentDirectMessage, restorePersistedSelection, initializeWithDefaultSelection]);

  // Periodically refresh agent conversations
  React.useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      loadAgentConversations();
    }, 15_000);
    return () => clearInterval(interval);
  }, [isConnected, loadAgentConversations]);

  // Filter out current user
  const filteredAgents = React.useMemo(() => {
    return agents.filter(agent => agent.agent_id !== currentUserId);
  }, [agents, currentUserId]);

  // Debug information
  console.log("MessagingSidebar Debug:", {
    connectionStatus: 'state' in connectionStatus ? connectionStatus.state : connectionStatus,
    connectionAgentId: 'agentId' in connectionStatus ? connectionStatus.agentId : undefined,
    networkAgentName: agentName,
    currentUserId,
    isConnected,
    channelsCount: channels.length,
    agentsCount: filteredAgents.length,
    isChannelLoading: channelsLoading,
    isDirectLoading: agentsLoading,
    channelsLoaded,
    agentsLoaded,
    currentChannel,
    currentDirectMessage,
  });

  // TODO: Implement unreadCounts logic
  const unreadCounts: Record<string, number> = {};

  // Channel selection handling - now using chatStore
  const onChannelSelect = (channel: string) => {
    selectChannel(channel);
  };

  // DM selection handling - now using chatStore
  const onDirectMessageSelect = (agentId: string) => {
    selectDirectMessage(agentId);
  };

  React.useEffect(() => {
    if (location.hash === "#create-channel") {
      setIsCreateChannelOpen(true);
    }
  }, [location.hash]);

  const loadUserAgentsForChannelCreate = React.useCallback(async () => {
    if (!selectedNetwork) return;

    setUserAgentsLoading(true);
    setChannelStatus("");
    try {
      const response = await networkFetch(selectedNetwork.host, selectedNetwork.port, "/api/user/agents", {
        useHttps: selectedNetwork.useHttps,
        networkId: selectedNetwork.networkId,
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error_message || data.error || response.statusText);
      }
      setUserAgents(data.agents || []);
    } catch (error) {
      setChannelStatus(error instanceof Error ? error.message : "Load agents failed");
      setUserAgents([]);
    } finally {
      setUserAgentsLoading(false);
    }
  }, [selectedNetwork]);

  React.useEffect(() => {
    if (!isCreateChannelOpen) return;
    loadUserAgentsForChannelCreate();
  }, [isCreateChannelOpen, loadUserAgentsForChannelCreate]);

  const toggleChannelAgent = (agentId: string) => {
    setSelectedChannelAgentIds((current) => {
      const next = current.includes(agentId)
        ? current.filter((item) => item !== agentId)
        : [...current, agentId];

      if (!next.includes(primaryChannelAgentId)) {
        setPrimaryChannelAgentId("");
      }
      return next;
    });
  };

  const selectedUserAgents = React.useMemo(
    () => userAgents.filter((agent) => selectedChannelAgentIds.includes(agent.agent_id)),
    [userAgents, selectedChannelAgentIds],
  );

  const createChannel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedNetwork || !channelName.trim()) return;

    setIsCreatingChannel(true);
    setChannelStatus("");
    try {
      const response = await networkFetch(selectedNetwork.host, selectedNetwork.port, "/api/user/channels", {
        method: "POST",
        body: JSON.stringify({
          name: channelName.trim(),
          description: channelDescription.trim(),
          agent_ids: selectedChannelAgentIds,
          primary_agent_id: primaryChannelAgentId || null,
        }),
        useHttps: selectedNetwork.useHttps,
        networkId: selectedNetwork.networkId,
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error_message || data.error || response.statusText);
      }

      setChannelName("");
      setChannelDescription("");
      setSelectedChannelAgentIds([]);
      setPrimaryChannelAgentId("");
      setIsCreateChannelOpen(false);
      useChatStore.setState({ channelsLoaded: false });
      await loadChannels();
    } catch (error) {
      setChannelStatus(error instanceof Error ? error.message : "Create channel failed");
    } finally {
      setIsCreatingChannel(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
     <div className="flex-1 overflow-y-auto">
      {/* Channels Section */}
      <SectionHeader title={t('sidebar.channels')} />
      <div className="px-3 mb-2">
        <button
          type="button"
          onClick={() => setIsCreateChannelOpen((value) => !value)}
          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-zinc-900"
        >
          <CirclePlus className="h-4 w-4" />
          Create Channel
        </button>
        {isCreateChannelOpen && (
          <form onSubmit={createChannel} className="mt-2 space-y-2 rounded border border-gray-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
            <input
              value={channelName}
              onChange={(event) => setChannelName(event.target.value)}
              placeholder="Name"
              className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm outline-none focus:border-gray-900 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              value={channelDescription}
              onChange={(event) => setChannelDescription(event.target.value)}
              placeholder="Description"
              className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm outline-none focus:border-gray-900 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Participating Agents
              </div>
              {userAgentsLoading ? (
                <div className="rounded border border-gray-200 px-2 py-2 text-xs text-gray-500 dark:border-zinc-800">
                  Loading agents...
                </div>
              ) : userAgents.length > 0 ? (
                <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-gray-200 p-1 dark:border-zinc-800">
                  {userAgents.map((agent) => (
                    <label
                      key={agent.agent_id}
                      className="flex min-h-8 items-center gap-2 rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-zinc-900"
                    >
                      <input
                        type="checkbox"
                        checked={selectedChannelAgentIds.includes(agent.agent_id)}
                        onChange={() => toggleChannelAgent(agent.agent_id)}
                      />
                      <span className="min-w-0 flex-1 truncate">{userAgentTitle(agent)}</span>
                      <span className="shrink-0 text-[11px] text-gray-400">{userAgentRuntime(agent)}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="rounded border border-gray-200 px-2 py-2 text-xs text-gray-500 dark:border-zinc-800">
                  No agents yet
                </div>
              )}
            </div>
            <label className="block space-y-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span>Primary Agent</span>
              <select
                value={primaryChannelAgentId}
                onChange={(event) => setPrimaryChannelAgentId(event.target.value)}
                disabled={selectedChannelAgentIds.length === 0}
                className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm font-normal text-gray-900 outline-none focus:border-gray-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-100"
              >
                <option value="">Auto claim</option>
                {selectedUserAgents.map((agent) => (
                  <option key={agent.agent_id} value={agent.agent_id}>
                    {userAgentTitle(agent)}
                  </option>
                ))}
              </select>
            </label>
            {channelStatus && <div className="text-xs text-red-600">{channelStatus}</div>}
            <button
              type="submit"
              disabled={!channelName.trim() || isCreatingChannel}
              className="h-8 rounded bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              {isCreatingChannel ? "Creating..." : "Create"}
            </button>
          </form>
        )}
      </div>
      <div className="px-3">
        {channelsLoading && channels.length === 0 ? (
          <div className="text-gray-500 text-sm px-2 py-2 text-center">
            {t('sidebar.loadingChannels')}
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {channels.map((channel) => (
              <ChannelItem
                key={channel.name}
                channel={channel}
                isActive={currentChannel === channel.name}
                unreadCount={unreadCounts[channel.name] || 0}
                onClick={() => onChannelSelect(channel.name)}
              />
            ))}
            {channels.length === 0 && !channelsLoading && (
              <div className="text-gray-500 text-sm px-2 py-2 text-center">
                {t('sidebar.noChannels')}
              </div>
            )}
          </ul>
        )}
      </div>

      {/* Direct Messages Section */}
      <SectionHeader title={t('sidebar.directMessages')} />
      <div className="px-3">
        {agentsLoading && filteredAgents.length === 0 ? (
          <div className="text-gray-500 text-sm px-2 py-2 text-center">
            {t('sidebar.loadingAgents')}
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {filteredAgents.map((agent) => (
              <AgentItem
                key={agent.agent_id}
                agent={agent}
                isActive={currentDirectMessage === agent.agent_id}
                unreadCount={unreadCounts[agent.agent_id] || 0}
                onClick={() => onDirectMessageSelect(agent.agent_id)}
              />
            ))}
            {filteredAgents.length === 0 && !agentsLoading && (
              <div className="text-gray-500 text-sm px-2 py-2 text-center">
                {t('sidebar.noAgents')}
              </div>
            )}
          </ul>
        )}
      </div>

      {/* Agent-to-Agent Conversations Section */}
      {agentConversations.length > 0 && (
        <>
          <SectionHeader title="Agent DMs" />
          <div className="px-3">
            <ul className="flex flex-col gap-1">
              {agentConversations.map((convo) => {
                const key = `${convo.agents[0]},${convo.agents[1]}`;
                const isActive = currentAgentConversation === key;
                const preview = convo.lastMessage.content
                  ? `${convo.lastMessage.sender}: ${convo.lastMessage.content}`.slice(0, 60)
                  : '';
                return (
                  <li key={key}>
                    <button
                      onClick={() => selectAgentConversation(key)}
                      className={`w-full text-left text-sm px-2 py-2 font-medium rounded transition-colors
                        ${isActive
                          ? "bg-[#F4F4F5] text-gray-900 dark:bg-[#F4F4F5] dark:text-gray-900 pl-2"
                          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-900 pl-2.5"
                        }
                      `}
                      title={`${convo.agents[0]} ↔ ${convo.agents[1]} (${convo.messageCount} messages)`}
                    >
                      <div className="flex items-center min-w-0">
                        <span className="mr-2 text-gray-400 text-xs">↔</span>
                        <span className="truncate text-xs">
                          {convo.agents[0]} ↔ {convo.agents[1]}
                        </span>
                      </div>
                      {preview && (
                        <div className="text-xs text-gray-400 truncate mt-0.5 pl-5">
                          {preview}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
     </div>
    </div>
  );
};

export default React.memo(MessagingSidebar);
