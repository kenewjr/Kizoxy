const request = require("supertest");
const { createTestApp, createMockGuild } = require("../../helpers/mockFactory");

const mockGetSettings = jest.fn();
const mockSaveSettings = jest.fn();

jest.mock("../../../src/persistence/levelSettingsStorage", () => ({
  getSettings: (...args) => mockGetSettings(...args),
  saveSettings: (...args) => mockSaveSettings(...args),
}));

describe("Guild Level Router Tests", () => {
  let app, guild, mockStorage;

  beforeEach(() => {
    guild = createMockGuild();
    mockStorage = {
      getLeaderboard: jest
        .fn()
        .mockResolvedValue([{ userId: "user-1", xp: 500, level: 3 }]),
      getUser: jest
        .fn()
        .mockResolvedValue({ userId: "user-1", xp: 500, level: 3 }),
      addXp: jest.fn().mockResolvedValue({
        user: { userId: "user-1", xp: 600, level: 3 },
      }),
    };

    const setup = createTestApp({
      guilds: {
        cache: new Map([[guild.id, guild]]),
      },
      levelStorage: mockStorage,
    });
    app = setup.app;
    mockGetSettings.mockReset();
    mockSaveSettings.mockReset();
  });

  describe("GET /api/guilds/:id/level/settings", () => {
    it("returns level settings successfully", async () => {
      mockGetSettings.mockReturnValue({ xp_enabled: true });
      const res = await request(app).get(
        `/api/guilds/${guild.id}/level/settings`,
      );
      expect(res.status).toBe(200);
      expect(res.body.xp_enabled).toBe(true);
    });

    it("returns 500 on error", async () => {
      mockGetSettings.mockImplementation(() => {
        throw new Error("Disk error");
      });
      const res = await request(app).get(
        `/api/guilds/${guild.id}/level/settings`,
      );
      expect(res.status).toBe(500);
    });
  });

  describe("PATCH /api/guilds/:id/level/settings", () => {
    it("saves settings successfully", async () => {
      mockSaveSettings.mockReturnValue({ xp_enabled: false });
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/level/settings`)
        .send({
          xp_enabled: false,
          level_up_channel_id: "444444444444444444",
          xp_min: 10,
          xp_max: 20,
          cooldown_seconds: 60,
        });
      expect(res.status).toBe(200);
      expect(res.body.xp_enabled).toBe(false);
    });

    it("returns 400 for invalid xp_enabled type", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/level/settings`)
        .send({ xp_enabled: "yes" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid level_up_channel_id format", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/level/settings`)
        .send({ level_up_channel_id: "abc" });
      expect(res.status).toBe(400);
    });

    it("returns 422 for non-existent channel", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/level/settings`)
        .send({ level_up_channel_id: "999999999999999999" });
      expect(res.status).toBe(422);
    });

    it("returns 400 for negative cooldown", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/level/settings`)
        .send({ cooldown_seconds: -10 });
      expect(res.status).toBe(400);
    });

    it("returns 400 when xp_min exceeds xp_max", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/level/settings`)
        .send({ xp_min: 50, xp_max: 10 });
      expect(res.status).toBe(400);
    });

    it("returns 500 on save error", async () => {
      mockSaveSettings.mockImplementation(() => {
        throw new Error("Save error");
      });
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/level/settings`)
        .send({ xp_enabled: false });
      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/guilds/:id/level/leaderboard", () => {
    it("returns leaderboard list successfully", async () => {
      const res = await request(app).get(
        `/api/guilds/${guild.id}/level/leaderboard`,
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].user_id).toBe("user-1");
    });
  });

  describe("POST /api/guilds/:id/level/xp", () => {
    it("adds XP successfully", async () => {
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/level/xp`)
        .send({ user_id: "111111111111111111", amount: 100, action: "add" });
      expect(res.status).toBe(200);
      expect(res.body.new_xp).toBe(600);
    });

    it("sets XP successfully", async () => {
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/level/xp`)
        .send({ user_id: "111111111111111111", amount: 100, action: "set" });
      expect(res.status).toBe(200);
    });

    it("removes XP successfully", async () => {
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/level/xp`)
        .send({ user_id: "111111111111111111", amount: 10, action: "remove" });
      expect(res.status).toBe(200);
    });

    it("returns 400 for invalid user_id format", async () => {
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/level/xp`)
        .send({ user_id: "invalid", amount: 100, action: "add" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid amount type", async () => {
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/level/xp`)
        .send({ user_id: "111111111111111111", amount: "lots", action: "add" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid action", async () => {
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/level/xp`)
        .send({
          user_id: "111111111111111111",
          amount: 100,
          action: "invalid",
        });
      expect(res.status).toBe(400);
    });
  });
});
