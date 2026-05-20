jest.mock("@bytecloud/common-lib", () => ({
  getJwt: jest.fn(),
}), { virtual: true })

import { getJwt } from "@bytecloud/common-lib"
import { getByteCloudJwt, getByteCloudJwtUniqueKey } from "../bytecloudJwtService"

const mockedGetJwt = getJwt as jest.MockedFunction<(key: string) => Promise<string>>

describe("bytecloudJwtService", () => {
  beforeEach(() => {
    mockedGetJwt.mockReset()
  })

  it("uses the local key on localhost", () => {
    expect(getByteCloudJwtUniqueKey("localhost")).toBe("local")
  })

  it("uses the online key outside localhost", () => {
    expect(getByteCloudJwtUniqueKey("10.37.123.28")).toBe("online")
  })

  it("gets a ByteCloud JWT from common-lib", async () => {
    mockedGetJwt.mockResolvedValue("jwt-token")

    await expect(getByteCloudJwt("10.37.123.28")).resolves.toBe("jwt-token")
    expect(mockedGetJwt).toHaveBeenCalledWith("online")
  })

  it("rejects when common-lib returns an empty JWT", async () => {
    mockedGetJwt.mockResolvedValue("  ")

    await expect(getByteCloudJwt("10.37.123.28")).rejects.toThrow("empty JWT")
  })
})
