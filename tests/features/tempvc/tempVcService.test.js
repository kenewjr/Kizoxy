const tempVcService = require("../src/features/tempvc/tempVcService");

jest.mock("../src/persistence/tempVcStorage", () => {
  const records = new Map();
  return {
    getGenerator: jest.fn(
      async (_g, channelId) => records.get(`gen:${channelId}`) || null,
    ),
    getTempChannel: jest.fn(
      async (_g, channelId) => records.get(`tc:${channelId}`) || null,
    ),
    getAllTempChannels: jest.fn(async () => []),
    getTemplate: jest.fn(async () => null),
    addTempChannel: jest.fn(async () => ({})),
    updateTempChannel: jest.fn(async () => ({})),
    removeTempChannel: jest.fn(async () => true),
    __seedGenerator: (id) => records.set(`gen:${id}`, { id }),
    __seedTempChannel: (id, owner) =>
      records.set(`tc:${id}`, { id, ownerId: owner }),
    __reset: () => records.clear(),
  };
});

const tempVcStorage = require("../src/persistence/tempVcStorage");

describe("tempVcService.renderChannelName", () => {
  const makeMember = (username, displayName) => ({
    user: { username },
    displayName,
  });

  test("substitutes {username}", () => {
    const out = tempVcService.renderChannelName(
      "{username}'s Channel",
      makeMember("alice", "Alice"),
      1,
    );
    expect(out).toBe("alice's Channel");
  });

  test("substitutes {displayname}", () => {
    const out = tempVcService.renderChannelName(
      "{displayname} hangout",
      makeMember("bob", "Bobby"),
      1,
    );
    expect(out).toBe("Bobby hangout");
  });

  test("substitutes {count}", () => {
    const out = tempVcService.renderChannelName(
      "Room #{count}",
      makeMember("c", "C"),
      7,
    );
    expect(out).toBe("Room #7");
  });

  test("placeholders are case-insensitive", () => {
    const out = tempVcService.renderChannelName(
      "{USERNAME} {DisplayName} {COUNT}",
      makeMember("dee", "Dee"),
      3,
    );
    expect(out).toBe("dee Dee 3");
  });

  test("falls back to default template when input is null", () => {
    const out = tempVcService.renderChannelName(
      null,
      makeMember("eve", "Eve"),
      1,
    );
    expect(out).toBe("eve's Channel");
  });

  test("strips control + zero-width characters", () => {
    const out = tempVcService.renderChannelName(
      "abc\u0001def\u200Bghi",
      makeMember("u", "U"),
      1,
    );
    expect(out).toBe("abcdefghi");
  });

  test("collapses internal whitespace and strips tabs as control chars", () => {
    const out = tempVcService.renderChannelName(
      "a    b\t\tc",
      makeMember("u", "U"),
      1,
    );
    // Tabs (0x09) are stripped by the control-char regex; only space chars
    // survive to the whitespace collapse step.
    expect(out).toBe("a bc");
  });

  test("truncates to 100 characters", () => {
    const long = "x".repeat(200);
    const out = tempVcService.renderChannelName(long, makeMember("u", "U"), 1);
    expect(out.length).toBe(100);
  });

  test("returns fallback when sanitisation reduces input to empty", () => {
    const out = tempVcService.renderChannelName(
      "\u0000\u0001\u200B",
      makeMember("u", "U"),
      1,
    );
    expect(out).toBe("Temporary Channel");
  });
});

describe("tempVcService.isGenerator / isTempChannel", () => {
  beforeEach(() => {
    tempVcStorage.__reset();
  });

  test("isGenerator returns false for unknown channel", async () => {
    const result = await tempVcService.isGenerator("g1", "unknown");
    expect(result).toBe(false);
  });

  test("isGenerator returns true once seeded", async () => {
    tempVcStorage.__seedGenerator("gen-id");
    const result = await tempVcService.isGenerator("g1", "gen-id");
    expect(result).toBe(true);
  });

  test("isTempChannel returns false for unknown channel", async () => {
    const result = await tempVcService.isTempChannel("g1", "unknown");
    expect(result).toBe(false);
  });

  test("isTempChannel returns true once seeded", async () => {
    tempVcStorage.__seedTempChannel("tvc-id", "owner-id");
    const result = await tempVcService.isTempChannel("g1", "tvc-id");
    expect(result).toBe(true);
  });

  test("guards against missing arguments", async () => {
    expect(await tempVcService.isGenerator(null, "x")).toBe(false);
    expect(await tempVcService.isGenerator("g", null)).toBe(false);
    expect(await tempVcService.isTempChannel(null, "x")).toBe(false);
    expect(await tempVcService.isTempChannel("g", null)).toBe(false);
  });
});

describe("[NEW] tempVcService.transferOwnership", () => {
  // The storage-throws test intentionally drives logger.error (console.error).
  let _errSpy;
  beforeAll(() => {
    _errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterAll(() => {
    _errSpy.mockRestore();
  });

  beforeEach(() => {
    tempVcStorage.__reset();
    jest.clearAllMocks();
  });

  // covers: missing args short-circuit to null before touching storage
  test("returns null when any argument is missing", async () => {
    expect(await tempVcService.transferOwnership(null, "c", "u")).toBeNull();
    expect(await tempVcService.transferOwnership("g", null, "u")).toBeNull();
    expect(await tempVcService.transferOwnership("g", "c", null)).toBeNull();
    expect(tempVcStorage.updateTempChannel).not.toHaveBeenCalled();
  });

  // covers: unknown channel returns null and never writes
  test("returns null when the temp channel record does not exist", async () => {
    const result = await tempVcService.transferOwnership("g1", "ghost", "u2");
    expect(result).toBeNull();
    expect(tempVcStorage.updateTempChannel).not.toHaveBeenCalled();
  });

  // covers: existing channel updates ownerId in storage and returns the record
  test("updates ownerId and returns the updated record", async () => {
    tempVcStorage.__seedTempChannel("tc-1", "old-owner");
    const result = await tempVcService.transferOwnership(
      "g1",
      "tc-1",
      "new-owner",
    );
    expect(result).not.toBeNull();
    expect(tempVcStorage.updateTempChannel).toHaveBeenCalledWith("g1", "tc-1", {
      ownerId: "new-owner",
    });
  });

  // covers: a storage write rejection is swallowed and surfaced as null
  test("returns null when the storage update throws", async () => {
    tempVcStorage.__seedTempChannel("tc-2", "old-owner");
    tempVcStorage.updateTempChannel.mockRejectedValueOnce(
      new Error("disk full"),
    );
    const result = await tempVcService.transferOwnership(
      "g1",
      "tc-2",
      "new-owner",
    );
    expect(result).toBeNull();
  });
});
