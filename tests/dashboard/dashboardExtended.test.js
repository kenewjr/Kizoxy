const request = require("supertest");

// Mock dependencies
jest.mock("../../src/integrations/youtube/channelResolver", () => ({
  resolveChannel: jest.fn().mockResolvedValue({
    youtubeChannelId: "UCtest123",
    youtubeChannelTitle: "Test YT Channel",
  }),
}));

jest.mock("../../src/integrations/tiktok/resolver", () => ({
  resolveProfile: jest.fn().mockReturnValue({
    username: "testtiktok",
    profileUrl: "https://www.tiktok.com/@testtiktok",
  }),
}));

// Mock storage
jest.mock("../../src/persistence/youtubeStorage", () => ({
  listSubscriptions: jest.fn().mockResolvedValue([]),
  addSubscription: jest.fn().mockImplementation((guildId, data) => ({
    id: "sub-yt-123",
    guildId,
    ...data,
  })),
  updateSubscription: jest.fn().mockImplementation((guildId, subId, patch) => ({
    id: subId,
    guildId,
    ...patch,
  })),
  removeSubscription: jest.fn().mockResolvedValue(),
  getChannelSubscriberMap: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock("../../src/persistence/tiktokStorage", () => ({
  listSubscriptions: jest.fn().mockResolvedValue([]),
  addSubscription: jest.fn().mockImplementation((guildId, data) => ({
    id: "sub-tt-123",
    guildId,
    ...data,
  })),
  updateSubscription: jest.fn().mockImplementation((guildId, subId, patch) => ({
    id: subId,
    guildId,
    ...patch,
  })),
  removeSubscription: jest.fn().mockResolvedValue(),
  getUserSubscriberMap: jest.fn().mockResolvedValue(new Map()),
  normalizeUsername: (u) => u.toLowerCase(),
}));

jest.mock("../../scripts/deploySlash", () => ({
  loadAndValidateCommands: jest
    .fn()
    .mockResolvedValue([{ name: ["ping"], description: "ping command" }]),
}));

// Mock REST
jest.mock("discord.js", () => {
  const actual = jest.requireActual("discord.js");
  class MockREST {
    setToken() {
      return this;
    }
    put() {
      return Promise.resolve([{ name: "ping" }]);
    }
  }
  return {
    ...actual,
    REST: MockREST,
  };
});

const mockChannel = {
  id: "channel-1",
  name: "general",
  type: 0,
  permissionsFor: () => ({
    has: () => true,
  }),
  send: jest.fn().mockResolvedValue({ id: "msg-123" }),
};

const mockGuild = {
  id: "guild-test-1",
  name: "Test Guild",
  memberCount: 42,
  ownerId: "owner123",
  iconURL: () => null,
  joinedAt: new Date("2024-01-01"),
  channels: { cache: new Map([["channel-1", mockChannel]]) },
  roles: { cache: new Map() },
};

const mockPlayer = {
  guildId: "guild-test-1",
  playing: true,
  paused: false,
  position: 1234,
  queue: {
    current: {
      title: "Test Track",
      author: "Test Artist",
      uri: "https://track.url",
      length: 5000,
    },
    length: 2,
  },
  voiceId: "vc-1",
  filtersState: { bassboost: true },
};

const mockClient = {
  user: {
    id: "bot123",
    username: "Kizoxy",
    tag: "Kizoxy#0001",
    displayAvatarURL: () => "https://example.com/avatar.png",
    setUsername: jest.fn().mockResolvedValue(),
    setPresence: jest.fn().mockResolvedValue({}),
  },
  ws: { status: 0 },
  guilds: { cache: new Map([["guild-test-1", mockGuild]]) },
  manager: {
    shoukaku: { nodes: new Map() },
    players: new Map([["guild-test-1", mockPlayer]]),
  },
  alarmScheduler: { jobs: new Map() },
  levelStorage: { getLeaderboard: jest.fn().mockResolvedValue([]) },
  config: { OWNER_ID: "owner123" },
};

const createDashboard = require("../../src/dashboard/server");
const app = createDashboard(mockClient);

describe("Extended Dashboard API Tests", () => {
  describe("YouTube Subscription Success Flows", () => {
    it("POST /api/guilds/:id/youtube creates a new sub", async () => {
      const res = await request(app)
        .post("/api/guilds/guild-test-1/youtube")
        .send({
          channel_input: "UCtest123",
          announce_channel_id: "channel-1",
        })
        .expect(201);
      expect(res.body.id).toBe("sub-yt-123");
      expect(res.body.youtubeChannelId).toBe("UCtest123");
    });

    it("PATCH /api/guilds/:id/youtube/:subId updates the sub", async () => {
      const res = await request(app)
        .patch("/api/guilds/guild-test-1/youtube/sub-yt-123")
        .send({
          notify_videos: false,
        })
        .expect(200);
      expect(res.body.notifyVideos).toBe(false);
    });
  });

  describe("TikTok Subscription Success Flows", () => {
    it("POST /api/guilds/:id/tiktok creates a new sub", async () => {
      const res = await request(app)
        .post("/api/guilds/guild-test-1/tiktok")
        .send({
          username_or_url: "@testtiktok",
          announce_channel_id: "channel-1",
        })
        .expect(201);
      expect(res.body.id).toBe("sub-tt-123");
      expect(res.body.username).toBe("testtiktok");
    });

    it("PATCH /api/guilds/:id/tiktok/:subId updates the sub", async () => {
      const res = await request(app)
        .patch("/api/guilds/guild-test-1/tiktok/sub-tt-123")
        .send({
          notify_live: false,
        })
        .expect(200);
      expect(res.body.notifyLive).toBe(false);
    });
  });

  describe("Slash Command Deploy API", () => {
    it("POST /api/deploy/slash with global scope successfully deploys", async () => {
      const res = await request(app)
        .post("/api/deploy/slash")
        .send({
          scope: "global",
        })
        .expect(200);
      expect(res.body.deployed).toBe(1);
      expect(res.body.scope).toBe("global");
    });

    it("POST /api/deploy/slash with guild scope successfully deploys", async () => {
      const res = await request(app)
        .post("/api/deploy/slash")
        .send({
          scope: "guild",
          guild_id: "12345678901234567",
        })
        .expect(200);
      expect(res.body.deployed).toBe(1);
      expect(res.body.scope).toBe("guild");
    });

    it("POST /api/deploy/slash validation checks invalid guild_id", async () => {
      await request(app)
        .post("/api/deploy/slash")
        .send({
          scope: "guild",
          guild_id: "invalid-id",
        })
        .expect(400);
    });
  });

  describe("Players Info API", () => {
    it("GET /api/players returns correct mock active players list", async () => {
      const res = await request(app).get("/api/players").expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].guild_name).toBe("Test Guild");
      expect(res.body[0].current_track.title).toBe("Test Track");
    });
  });
});
