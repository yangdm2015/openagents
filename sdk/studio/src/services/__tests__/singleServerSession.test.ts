import {
  deriveUserAgentName,
  getSingleServerNetwork,
  isHardcodedAdminUser,
} from "../singleServerSession"

describe("singleServerSession", () => {
  it("uses the current HTTP server as the only OpenAgents server", () => {
    const network = getSingleServerNetwork({
      hostname: "10.37.123.28",
      port: "8700",
      protocol: "http:",
    })

    expect(network).toMatchObject({
      host: "10.37.123.28",
      port: 8700,
      useHttps: false,
    })
  })

  it("uses standard ports when the browser URL has no explicit port", () => {
    expect(getSingleServerNetwork({ hostname: "openagents.example", port: "", protocol: "https:" }).port).toBe(443)
    expect(getSingleServerNetwork({ hostname: "openagents.example", port: "", protocol: "http:" }).port).toBe(80)
  })

  it("derives a stable web agent id from the SSO user", () => {
    expect(
      deriveUserAgentName({
        id: "u1",
        email: "yangshan.andy@bytedance.com",
        username: "yangshan.andy",
      })
    ).toBe("user_yangshan_andy")
  })

  it("only grants admin UI access to the hardcoded email prefix", () => {
    expect(isHardcodedAdminUser({ id: "u1", email: "yangshan.andy@bytedance.com" })).toBe(true)
    expect(isHardcodedAdminUser({ id: "u2", email: "other@bytedance.com" })).toBe(false)
  })
})
