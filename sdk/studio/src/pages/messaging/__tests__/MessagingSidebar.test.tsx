// @ts-nocheck
import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { networkFetch } from "@/utils/httpClient"
import { useChatStore } from "@/stores/chatStore"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "sidebar.channels": "Channels",
        "sidebar.directMessages": "Direct Messages",
        "sidebar.loadingChannels": "Loading channels",
        "sidebar.noChannels": "No channels",
        "sidebar.loadingAgents": "Loading agents",
        "sidebar.noAgents": "No agents",
      }
      return labels[key] || key
    },
  }),
}))

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ hash: "", pathname: "/messages" }),
}), { virtual: true })

jest.mock("@/context/OpenAgentsProvider", () => ({
  useOpenAgents: () => ({
    connector: {
      isConnected: () => true,
      getAgentId: () => "user_yangshan_andy",
      sendEvent: jest.fn(() => Promise.resolve({ success: true, data: { channels: [] } })),
    },
    connectionStatus: { state: "connected", agentId: "user_yangshan_andy" },
    isConnected: true,
  }),
}))

jest.mock("@/stores/authStore", () => {
  const selectedNetwork = {
      host: "10.37.123.28",
      port: 8700,
      useHttps: false,
      networkId: undefined,
  }
  return {
    useAuthStore: () => ({
      agentName: "user_yangshan_andy",
      selectedNetwork,
    }),
  }
})

jest.mock("@/utils/httpClient", () => ({
  networkFetch: jest.fn(),
}))

const MessagingSidebar = require("../MessagingSidebar").default

describe("MessagingSidebar channel creation", () => {
  beforeEach(() => {
    useChatStore.setState({
      currentChannel: "general",
      currentDirectMessage: null,
      currentAgentConversation: null,
      channels: [],
      channelsLoading: false,
      channelsLoaded: true,
      agents: [],
      agentsLoading: false,
      agentsLoaded: true,
      agentConversations: [],
      agentConversationsLoaded: true,
    })
    ;(networkFetch as jest.Mock).mockReset()
    ;(networkFetch as jest.Mock).mockImplementation((_host, _port, endpoint, init = {}) => {
      if (endpoint === "/api/user/agents") {
        return Promise.resolve(new Response(JSON.stringify({
          success: true,
          agents: [
            {
              agent_id: "planner",
              agent_type: "codex",
              config: { display_name: "Planner", runtime: "codex" },
            },
          ],
        })))
      }

      if (endpoint === "/api/user/channels" && init.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({
          success: true,
          channel: {
            id: "c1",
            name: "private",
            channel_name: "u_owner_private",
            agents: ["planner"],
            primary_agent_id: "planner",
          },
        })))
      }

      return Promise.resolve(new Response(JSON.stringify({ success: true })))
    })
  })

  it("lets a user choose participating agents and a primary agent when creating a channel", async () => {
    render(<MessagingSidebar />)

    fireEvent.click(screen.getByRole("button", { name: /create channel/i }))

    expect(await screen.findByText("Planner")).not.toBeNull()
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.change(screen.getByRole("combobox", { name: /Primary Agent/i }), {
      target: { value: "planner" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(networkFetch).toHaveBeenCalledWith(
        "10.37.123.28",
        8700,
        "/api/user/channels",
        expect.objectContaining({ method: "POST" }),
      )
    })

    const createCall = (networkFetch as jest.Mock).mock.calls.find((call) => call[2] === "/api/user/channels")
    expect(JSON.parse(createCall[3].body)).toMatchObject({
      name: "private",
      agent_ids: ["planner"],
      primary_agent_id: "planner",
    })
  })
})
