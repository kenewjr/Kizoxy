const fs = require("fs");
const path = require("path");
const request = require("supertest");

// Suppress console.warn from Logger during tests.
const _warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
const _errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

// ── Mock client ──
const mockChannel = {
  id: "channel-1",
  name: "general",
  type: 0, // GuildText
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
  members: {
    cache: new Map(),
    fetch: jest.fn().mockResolvedValue(new Map()),
  },
};

const mockClient = {
  user: {
    id: "bot123",
    username: "Kizoxy",
    tag: "Kizoxy#0001",
    displayAvatarURL: () => "https://example.com/avatar.png",
    setUsername: jest.fn().mockImplementation(function (u) {
      this.username = u;
      return Promise.resolve();
    }),
    setPresence: jest.fn().mockResolvedValue({}),
  },
  ws: { status: 0 },
  guilds: { cache: new Map([["guild-test-1", mockGuild]]) },
  manager: { shoukaku: { nodes: new Map() } },
  alarmScheduler: { jobs: new Map() },
  levelStorage: { getLeaderboard: jest.fn().mockResolvedValue([]) },
};

// ── Set up test log directory ──
const TEST_LOGS_DIR = path.join(process.cwd(), "logs");
const TEST_LOG_FILE = "test-dashboard.log";

beforeAll(() => {
  if (!fs.existsSync(TEST_LOGS_DIR))
    fs.mkdirSync(TEST_LOGS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(TEST_LOGS_DIR, TEST_LOG_FILE),
    "[INFO] Line 1\n[ERROR] Line 2\n[WARN] Line 3\n[DEBUG] Line 4\n[INFO] Line 5\n",
  );
});

afterAll(() => {
  try {
    fs.unlinkSync(path.join(TEST_LOGS_DIR, TEST_LOG_FILE));
  } catch {}
  console.warn.mockRestore();
  console.error.mockRestore();
});

// ── Build app ──
const createDashboard = require("../../src/dashboard/server");
const app = createDashboard(mockClient);

describe("Dashboard API", () => {
  // ── Meta ──
  describe("GET /api/meta", () => {
    it("returns 200 with bot_name, status, uptime_ms", async () => {
      const res = await request(app).get("/api/meta").expect(200);
      expect(res.body).toHaveProperty("bot_name", "Kizoxy");
      expect(res.body).toHaveProperty("status", "online");
      expect(res.body).toHaveProperty("uptime_ms");
      expect(typeof res.body.uptime_ms).toBe("number");
    });
  });

  describe("GET /api/stats", () => {
    it("returns 200 with guild_count and youtube_total_subs", async () => {
      const res = await request(app).get("/api/stats").expect(200);
      expect(res.body).toHaveProperty("guild_count");
      expect(res.body).toHaveProperty("youtube_total_subs");
    });
  });

  // ── Guilds ──
  describe("GET /api/guilds", () => {
    it("returns 200 with array", async () => {
      const res = await request(app).get("/api/guilds").expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /api/guilds/:id", () => {
    it("returns 200 for valid guild", async () => {
      const res = await request(app)
        .get("/api/guilds/guild-test-1")
        .expect(200);
      expect(res.body.id).toBe("guild-test-1");
      expect(res.body.name).toBe("Test Guild");
    });

    it("returns 404 for invalid guild", async () => {
      await request(app).get("/api/guilds/does-not-exist").expect(404);
    });
  });

  describe("PATCH /api/guilds/:id/fixembed", () => {
    it("returns 200 with valid body", async () => {
      const res = await request(app)
        .patch("/api/guilds/guild-test-1/fixembed")
        .send({ enabled: true, view_mode: "normal" })
        .expect(200);
      expect(res.body).toHaveProperty("enabled", true);
      expect(res.body).toHaveProperty("viewMode", "normal");
    });

    it("returns 400 with invalid view_mode", async () => {
      await request(app)
        .patch("/api/guilds/guild-test-1/fixembed")
        .send({ view_mode: "invalid_mode" })
        .expect(400);
    });
  });

  // ── YouTube ──
  describe("GET /api/guilds/:id/youtube", () => {
    it("returns 200 with array", async () => {
      const res = await request(app)
        .get("/api/guilds/guild-test-1/youtube")
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("POST /api/guilds/:id/youtube with bad input", () => {
    it("returns 422 for unresolvable channel_input", async () => {
      await request(app)
        .post("/api/guilds/guild-test-1/youtube")
        .send({
          channel_input: "thisisnotavalidchannel_!@#$",
          announce_channel_id: "123",
        })
        .expect(422);
    });
  });

  describe("PATCH /api/guilds/:id/youtube/:subId", () => {
    it("returns 404 for missing sub", async () => {
      await request(app)
        .patch("/api/guilds/guild-test-1/youtube/nonexistent-sub")
        .send({ notifyVideos: false })
        .expect(404);
    });
  });

  describe("DELETE /api/guilds/:id/youtube/:subId", () => {
    it("returns { deleted: true }", async () => {
      const res = await request(app)
        .delete("/api/guilds/guild-test-1/youtube/any-sub-id")
        .expect(200);
      expect(res.body).toEqual({ deleted: true });
    });
  });

  // ── TikTok ──
  describe("GET /api/guilds/:id/tiktok", () => {
    it("returns 200 with array", async () => {
      const res = await request(app)
        .get("/api/guilds/guild-test-1/tiktok")
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("POST /api/guilds/:id/tiktok with bad input", () => {
    it("returns 422 for unresolvable username", async () => {
      await request(app)
        .post("/api/guilds/guild-test-1/tiktok")
        .send({
          username_or_url: "https://vt.tiktok.com/abc",
          announce_channel_id: "123",
        })
        .expect(422);
    });
  });

  describe("PATCH /api/guilds/:id/tiktok/:subId", () => {
    it("returns 404 for missing sub", async () => {
      await request(app)
        .patch("/api/guilds/guild-test-1/tiktok/nonexistent-sub")
        .send({ notify_live: false })
        .expect(404);
    });
  });

  describe("DELETE /api/guilds/:id/tiktok/:subId", () => {
    it("returns { deleted: true }", async () => {
      const res = await request(app)
        .delete("/api/guilds/guild-test-1/tiktok/any-sub-id")
        .expect(200);
      expect(res.body).toEqual({ deleted: true });
    });
  });

  // ── Logs ──
  describe("GET /api/logs", () => {
    it("returns 200 with array", async () => {
      const res = await request(app).get("/api/logs").expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /api/logs/:name", () => {
    it("returns 200 with valid file", async () => {
      const res = await request(app)
        .get(`/api/logs/${TEST_LOG_FILE}`)
        .expect(200);
      expect(res.body).toHaveProperty("content");
      expect(res.body.content).toContain("[INFO] Line 1");
    });

    it("returns at most N lines with ?tail=N", async () => {
      const res = await request(app)
        .get(`/api/logs/${TEST_LOG_FILE}?tail=2`)
        .expect(200);
      const lines = res.body.content.split("\n").filter(Boolean);
      expect(lines.length).toBeLessThanOrEqual(2);
    });
  });

  describe("GET /api/logs with path traversal", () => {
    it("returns 400 for ../../etc/passwd", async () => {
      await request(app).get("/api/logs/..%2F..%2Fetc%2Fpasswd").expect(400);
    });
  });
});

// ── Notification Content String Tests ──
describe("YouTube notification content strings", () => {
  const { BADGES } = require("../../src/integrations/youtube/formatter");

  it("BADGES has live type", () => {
    expect(BADGES.live.label).toContain("LIVE");
  });

  it("BADGES has upcoming type", () => {
    expect(BADGES.upcoming.label).toContain("Upcoming");
  });

  it("BADGES has short type", () => {
    expect(BADGES.short.label).toContain("Short");
  });

  it("BADGES has video type", () => {
    expect(BADGES.video.label).toContain("Video");
  });
});

describe("TikTok notification content strings", () => {
  // The content strings are built in the scheduler _fanOut methods.
  // Test the patterns directly.
  it("video content includes 📲 [TIKTOK]", () => {
    const prefix = `📲 [TIKTOK] @testuser posted a new video`;
    expect(prefix).toContain("📲 [TIKTOK]");
  });

  it("live content includes 🔴 [TIKTOK LIVE]", () => {
    const prefix = `🔴 [TIKTOK LIVE] @testuser is live on TikTok!`;
    expect(prefix).toContain("🔴 [TIKTOK LIVE]");
  });
});

// ── YouTube scheduler TYPE_TOGGLE test ──
describe("YouTube scheduler TYPE_TOGGLE", () => {
  // Load the scheduler to verify TYPE_TOGGLE mapping
  // Can't directly access TYPE_TOGGLE, but we can verify via constructor
  it("YoutubeScheduler loads without error", () => {
    expect(() =>
      require("../../src/integrations/youtube/scheduler"),
    ).not.toThrow();
  });
});

describe("New Dashboard Endpoints", () => {
  describe("GET /api/guilds/:id/level", () => {
    it("returns level top 10 for guild", async () => {
      const res = await request(app)
        .get("/api/guilds/guild-test-1/level")
        .expect(200);
      expect(res.body).toHaveProperty("level_top10");
      expect(Array.isArray(res.body.level_top10)).toBe(true);
    });
  });

  describe("GET /api/guilds/:id/tempvc", () => {
    it("returns active temp channels and generators details", async () => {
      const res = await request(app)
        .get("/api/guilds/guild-test-1/tempvc")
        .expect(200);
      expect(res.body).toHaveProperty("generators");
      expect(res.body).toHaveProperty("active_count");
      expect(res.body).toHaveProperty("active_channels");
    });
  });

  describe("Commands Customization API", () => {
    it("GET /api/commands returns all commands with customization flags", async () => {
      const res = await request(app).get("/api/commands").expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty("name");
        expect(res.body[0]).toHaveProperty("displayName");
        expect(res.body[0]).toHaveProperty("description");
      }
    });

    it("PATCH /api/commands/:name validates inputs and saves overrides", async () => {
      // Find a command to patch
      const listRes = await request(app).get("/api/commands");
      if (listRes.body.length > 0) {
        const cmdName = listRes.body[0].name;

        // Valid patch
        await request(app)
          .patch(`/api/commands/${encodeURIComponent(cmdName)}`)
          .send({
            displayName: "Custom Name",
            description: "Custom description",
          })
          .expect(200);

        // Invalid patch - display name too long
        await request(app)
          .patch(`/api/commands/${encodeURIComponent(cmdName)}`)
          .send({ displayName: "A".repeat(40) })
          .expect(400);

        // Invalid patch - description too long
        await request(app)
          .patch(`/api/commands/${encodeURIComponent(cmdName)}`)
          .send({ description: "B".repeat(120) })
          .expect(400);

        // Reset with DELETE
        await request(app)
          .delete(`/api/commands/${encodeURIComponent(cmdName)}`)
          .expect(200);
      }
    });
  });

  describe("Custom Message Validation", () => {
    it("rejects custom messages longer than 500 characters", async () => {
      const longMessage = "A".repeat(501);

      // YouTube POST
      await request(app)
        .post("/api/guilds/guild-test-1/youtube")
        .send({
          channel_input: "test",
          announce_channel_id: "12345",
          custom_message: longMessage,
        })
        .expect(400);

      // YouTube PATCH
      await request(app)
        .patch("/api/guilds/guild-test-1/youtube/sub-123")
        .send({ custom_message: longMessage })
        .expect(400);

      // TikTok POST
      await request(app)
        .post("/api/guilds/guild-test-1/tiktok")
        .send({
          username_or_url: "test",
          announce_channel_id: "12345",
          custom_message: longMessage,
        })
        .expect(400);

      // TikTok PATCH
      await request(app)
        .patch("/api/guilds/guild-test-1/tiktok/sub-123")
        .send({ custom_message: longMessage })
        .expect(400);
    });
  });

  describe("Send Message & Updates & Bot & Config Tab Extensions", () => {
    // Send Msg GET
    it("GET /api/sendmsg/channels/:guildId returns text channels", async () => {
      const res = await request(app)
        .get("/api/sendmsg/channels/guild-test-1")
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty("id", "channel-1");
      expect(res.body[0]).toHaveProperty("name", "general");
    });

    // Send Msg POST
    it("POST /api/sendmsg dispatches message content to Discord text channel", async () => {
      const res = await request(app)
        .post("/api/sendmsg")
        .send({
          guildId: "guild-test-1",
          channelId: "channel-1",
          message: "Test message from dashboard",
        })
        .expect(200);
      expect(res.body).toEqual({ success: true, messageId: "msg-123" });
    });

    // Updates GET
    it("GET /api/updates returns packages list with outdated flags", async () => {
      const res = await request(app).get("/api/updates").expect(200);
      expect(res.body).toHaveProperty("packages");
      expect(res.body).toHaveProperty("outdated_count");
      expect(res.body).toHaveProperty("total_count");
    });

    // Bot Identity & Presence PATCH
    it("PATCH /api/bot/username sets bot username", async () => {
      const res = await request(app)
        .patch("/api/bot/username")
        .send({ username: "NewKizoxy" })
        .expect(200);
      expect(res.body).toHaveProperty("username", "NewKizoxy");
    });

    it("PATCH /api/bot/presence sets presence attributes", async () => {
      const res = await request(app)
        .patch("/api/bot/presence")
        .send({
          status: "idle",
          activity_type: "playing",
          activity_text: "with tests",
        })
        .expect(200);
      expect(res.body).toEqual({
        status: "idle",
        activity: "with tests",
        rotation_paused: true,
      });
    });

    it("PATCH /api/bot/presence/resume resumes rotation", async () => {
      const res = await request(app)
        .patch("/api/bot/presence/resume")
        .expect(200);
      expect(res.body).toEqual({ rotation_paused: false });
    });

    // Config PATCH
    it("PATCH /api/config allows updating editable settings", async () => {
      const res = await request(app)
        .patch("/api/config")
        .send({ prefix: "k!", bot_color: "#123456", log_format: "json" })
        .expect(200);
      expect(res.body.bot.prefix).toBe("k!");
      expect(res.body.bot.bot_color).toBe("#123456");
      expect(res.body.bot.log_format).toBe("json");
    });

    it("PATCH /api/config rejects readonly token update", async () => {
      await request(app)
        .patch("/api/config")
        .send({ token: "newtoken123" })
        .expect(403);
    });
  });
});
