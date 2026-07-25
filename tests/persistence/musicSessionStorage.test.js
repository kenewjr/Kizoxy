const fs = require("fs");
const path = require("path");
const musicSessionStorage = require("../../src/persistence/musicSessionStorage");

describe("musicSessionStorage Persistence Tests", () => {
  const filepath = path.join(__dirname, "../../data/musicSessions.json");

  beforeEach(async () => {
    // Clear state/files before each test
    musicSessionStorage._clearCache();
    if (fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
      } catch (_) {}
    }
  });

  afterEach(async () => {
    musicSessionStorage._clearCache();
    if (fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
      } catch (_) {}
    }
  });

  it("saves and retrieves sessions correctly", async () => {
    const session = {
      guildId: "123",
      voiceChannelId: "456",
      textChannelId: "789",
      currentTrack: { uri: "https://track", title: "Track", requesterId: "u1" },
      positionMs: 5000,
      queue: [],
      volume: 100,
      loopMode: "none",
      savedAt: Date.now(),
    };

    await musicSessionStorage.saveSession("123", session);
    const retrieved = await musicSessionStorage.getSession("123");
    expect(retrieved).toEqual(session);
  });

  it("returns null for expired sessions", async () => {
    const session = {
      guildId: "123",
      savedAt: Date.now() - (musicSessionStorage.SESSION_MAX_AGE_MS + 1000),
    };

    await musicSessionStorage.saveSession("123", session);
    const retrieved = await musicSessionStorage.getSession("123");
    expect(retrieved).toBeNull();
  });

  it("deletes sessions correctly", async () => {
    const session = {
      guildId: "123",
      savedAt: Date.now(),
    };

    await musicSessionStorage.saveSession("123", session);
    await musicSessionStorage.deleteSession("123");
    const retrieved = await musicSessionStorage.getSession("123");
    expect(retrieved).toBeNull();
  });

  it("gets all non-expired sessions and cleans up expired ones", async () => {
    const valid = { guildId: "valid", savedAt: Date.now() };
    const expired = {
      guildId: "expired",
      savedAt: Date.now() - (musicSessionStorage.SESSION_MAX_AGE_MS + 1000),
    };

    await musicSessionStorage.saveSession("valid", valid);
    await musicSessionStorage.saveSession("expired", expired);

    const all = await musicSessionStorage.getAllSessions();
    expect(all).toHaveLength(1);
    expect(all[0].guildId).toBe("valid");

    // Expired should have been deleted from cache and file
    const retrievedExpired = await musicSessionStorage.getSession("expired");
    expect(retrievedExpired).toBeNull();
  });

  it("recovers from backup file if primary is corrupted", async () => {
    // Write corrupted data to primary file and valid data to bak file
    const fsPromises = require("fs").promises;
    await fsPromises.mkdir(path.dirname(filepath), { recursive: true });
    await fsPromises.writeFile(filepath, "invalid json");
    await fsPromises.writeFile(
      `${filepath}.bak`,
      JSON.stringify({
        "recovered-guild": { guildId: "recovered-guild", savedAt: Date.now() },
      }),
    );

    const retrieved = await musicSessionStorage.getSession("recovered-guild");
    expect(retrieved).not.toBeNull();
    expect(retrieved.guildId).toBe("recovered-guild");
  });

  it("handles loading errors and falls back to empty cache", async () => {
    const fsPromises = require("fs").promises;
    await fsPromises.mkdir(path.dirname(filepath), { recursive: true });
    await fsPromises.writeFile(filepath, "invalid json");
    await fsPromises.writeFile(`${filepath}.bak`, "corrupted backup too");

    const retrieved = await musicSessionStorage.getSession("any-guild");
    expect(retrieved).toBeNull();
  });
});
