const request = require("supertest");
const { createTestApp, createMockGuild } = require("../../helpers/mockFactory");

jest.mock("../../../src/persistence/fixembedStorage", () => ({
  getSettings: jest
    .fn()
    .mockReturnValue({ enabled: true, viewMode: "normal", platforms: {} }),
  saveSettings: jest.fn().mockImplementation((id, data) => ({ id, ...data })),
}));

jest.mock("../../../src/persistence/levelSettingsStorage", () => ({
  getSettings: jest.fn().mockReturnValue({ xp_enabled: true }),
  saveSettings: jest.fn().mockImplementation((id, data) => ({ id, ...data })),
}));

describe("Guilds Route Tests", () => {
  let app, guild;

  beforeEach(() => {
    guild = createMockGuild();
    const mockStorage = {
      getLeaderboard: jest
        .fn()
        .mockResolvedValue([{ userId: "user-1", xp: 500, level: 3 }]),
      getUser: jest
        .fn()
        .mockResolvedValue({ userId: "user-1", xp: 500, level: 3 }),
      addXp: jest.fn().mockResolvedValue({
        user: { userId: "user-1", xp: 600, level: 3 },
      }),
      setXp: jest.fn().mockResolvedValue({
        user: { userId: "user-1", xp: 700, level: 4 },
      }),
      setChannel: jest.fn(),
      removeChannel: jest.fn(),
    };
    const alarmStorageMock = {
      get: jest
        .fn()
        .mockResolvedValue({ id: "alarm-1", guildId: guild.id, time: "12:00" }),
    };

    const clientOverrides = {
      guilds: {
        cache: new Map([[guild.id, guild]]),
      },
      levelStorage: mockStorage,
      alarmStorage: alarmStorageMock,
    };

    const setup = createTestApp(clientOverrides);
    app = setup.app;
  });

  describe("GET /api/guilds", () => {
    it("returns array of guilds", async () => {
      const res = await request(app).get("/api/guilds");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /api/guilds/:id", () => {
    it("returns detail for valid guild", async () => {
      const res = await request(app).get(`/api/guilds/${guild.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(guild.id);
    });

    it("returns 404 for unknown guild", async () => {
      const res = await request(app).get("/api/guilds/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/guilds/:id/fixembed", () => {
    it("saves views settings with valid parameters", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ enabled: true, view_mode: "normal" });
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
      expect(res.body.viewMode).toBe("normal");
    });

    it("returns 400 for invalid parameters", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ view_mode: "invalid_mode" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/guilds/:id/level", () => {
    it("returns level leaderboard data", async () => {
      const res = await request(app).get(`/api/guilds/${guild.id}/level`);
      expect(res.status).toBe(200);
      expect(res.body.level_top10).toBeDefined();
    });
  });

  describe("POST /api/guilds/:id/level/xp", () => {
    it("modifies user XP successfully", async () => {
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/level/xp`)
        .send({ user_id: "111111111111111111", amount: 100, action: "add" });
      expect(res.status).toBe(200);
      expect(res.body.new_xp).toBe(600);
    });

    it("returns 400 for invalid snowflake user_id", async () => {
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/level/xp`)
        .send({ user_id: "abc", amount: 100, action: "add" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for negative or floating amount", async () => {
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/level/xp`)
        .send({ user_id: "111111111111111111", amount: -50, action: "add" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/guilds/:id/tempvc", () => {
    it("returns tempvc stats", async () => {
      const res = await request(app).get(`/api/guilds/${guild.id}/tempvc`);
      expect(res.status).toBe(200);
      expect(res.body.active_count).toBeDefined();
    });
  });
});
