const request = require("supertest");
const { createTestApp, createMockGuild } = require("../../helpers/mockFactory");

const mockGetSettings = jest.fn();
const mockSaveSettings = jest.fn();

jest.mock("../../../src/persistence/fixembedStorage", () => ({
  getSettings: (...args) => mockGetSettings(...args),
  saveSettings: (...args) => mockSaveSettings(...args),
}));

describe("Guild FixEmbed Router Tests", () => {
  let app, guild;

  beforeEach(() => {
    guild = createMockGuild();
    const setup = createTestApp({
      guilds: {
        cache: new Map([[guild.id, guild]]),
      },
    });
    app = setup.app;
    mockGetSettings.mockReset();
    mockSaveSettings.mockReset();
  });

  describe("GET /api/guilds/:id/fixembed", () => {
    it("returns settings successfully", async () => {
      mockGetSettings.mockReturnValue({
        enabled: true,
        viewMode: "normal",
        platforms: {},
      });
      const res = await request(app).get(`/api/guilds/${guild.id}/fixembed`);
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
    });

    it("returns 500 on error", async () => {
      mockGetSettings.mockImplementation(() => {
        throw new Error("Disk error");
      });
      const res = await request(app).get(`/api/guilds/${guild.id}/fixembed`);
      expect(res.status).toBe(500);
    });
  });

  describe("PATCH /api/guilds/:id/fixembed", () => {
    beforeEach(() => {
      mockGetSettings.mockReturnValue({
        enabled: true,
        deleteBehavior: "suppress",
        platforms: {
          twitter: { enabled: true, viewMode: "normal" },
        },
      });
    });

    it("accepts valid parameters and saves settings", async () => {
      mockSaveSettings.mockReturnValue({
        enabled: false,
        deleteBehavior: "delete",
      });
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({
          enabled: false,
          deleteBehavior: "delete",
          spoilerPassthrough: true,
          ignoredChannels: ["444444444444444444"],
          ignoredDomains: ["nitter.net"],
          ignoredUsers: ["777777777777777777"],
          ignoredRoles: ["888888888888888888"],
          ignoredKeywords: ["leak"],
          viewMode: "gallery",
          platforms: {
            twitter: { enabled: false, viewMode: "gallery" },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(mockSaveSettings).toHaveBeenCalled();
    });

    it("returns 400 for invalid enabled", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ enabled: "yes" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid deleteBehavior", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ deleteBehavior: "destroy" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid spoilerPassthrough", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ spoilerPassthrough: "not-bool" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid ignoredChannels", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ ignoredChannels: "invalid" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid channel id format", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ ignoredChannels: ["123"] });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid ignoredDomains", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ ignoredDomains: "invalid" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid domain length", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ ignoredDomains: ["a".repeat(101)] });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid ignoredUsers", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ ignoredUsers: "invalid" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid user id format", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ ignoredUsers: ["abc"] });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid ignoredRoles", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ ignoredRoles: "invalid" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid role id format", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ ignoredRoles: ["abc"] });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid ignoredKeywords", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ ignoredKeywords: "invalid" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid keyword length", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ ignoredKeywords: ["a".repeat(101)] });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid viewMode", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ viewMode: "invalid-mode" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid platforms type", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ platforms: "invalid" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for unknown platform", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ platforms: { unknown: { enabled: true } } });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid platform config type", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ platforms: { twitter: "invalid" } });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid platform enabled type", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ platforms: { twitter: { enabled: "yes" } } });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid platform viewMode", async () => {
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ platforms: { twitter: { viewMode: "invalid" } } });
      expect(res.status).toBe(400);
    });

    it("returns 500 on save error", async () => {
      mockSaveSettings.mockImplementation(() => {
        throw new Error("Save error");
      });
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/fixembed`)
        .send({ enabled: false });
      expect(res.status).toBe(500);
    });
  });
});
