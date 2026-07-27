jest.mock("../../../src/lib/logger", () => {
  return jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }));
});

const ready = require("../../../src/events/player/ready");

describe("Player Ready Event Tests", () => {
  let client, mockSearch;

  beforeEach(() => {
    mockSearch = jest.fn().mockResolvedValue({});
    client = {
      user: { id: "bot123" },
      manager: {
        search: mockSearch,
      },
    };
  });

  it("fires warmup search on new node ready (non-resumed)", async () => {
    await ready(client, "nodeA", false, false);
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith("spsearch:test warmup query", {
      requester: { id: "bot123" },
    });
  });

  it("uses default id 0 if client.user is not set", async () => {
    client.user = null;
    await ready(client, "nodeA", false, false);
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith("spsearch:test warmup query", {
      requester: { id: "0" },
    });
  });

  it("does not fire warmup search on resumed session", async () => {
    await ready(client, "nodeA", true, false);
    expect(mockSearch).not.toHaveBeenCalled();

    await ready(client, "nodeA", false, true);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("catches failure and does not throw", async () => {
    mockSearch.mockRejectedValue(new Error("Search error"));
    await expect(ready(client, "nodeA", false, false)).resolves.not.toThrow();
  });
});
