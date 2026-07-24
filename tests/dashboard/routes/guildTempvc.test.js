const request = require("supertest");
const { createTestApp, createMockGuild } = require("../../helpers/mockFactory");

const mockGetGenerator = jest.fn();
const mockUpdateGenerator = jest.fn();
const mockGuild = jest.fn();

jest.mock("../../../src/persistence/tempVcStorage", () => ({
  _guild: (...args) => mockGuild(...args),
  getGenerator: (...args) => mockGetGenerator(...args),
  updateGenerator: (...args) => mockUpdateGenerator(...args),
  getTemplate: jest.fn().mockResolvedValue({ id: "tmpl-1" }),
}));

describe("Guild TempVC Router Tests", () => {
  let app, guild;

  beforeEach(() => {
    guild = createMockGuild();
    const setup = createTestApp({
      guilds: {
        cache: new Map([[guild.id, guild]]),
      },
    });
    app = setup.app;
    mockGetGenerator.mockReset();
    mockUpdateGenerator.mockReset();
    mockGuild.mockReset();
  });

  describe("GET /api/guilds/:id/tempvc/generators", () => {
    it("returns generator list successfully", async () => {
      mockGuild.mockResolvedValue({
        generators: {
          "gen-1": { id: "gen-1", defaultName: "Room" },
        },
        tempChannels: {},
        voiceRoles: [],
        templates: {},
      });

      const res = await request(app).get(
        `/api/guilds/${guild.id}/tempvc/generators`,
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].id).toBe("gen-1");
    });

    it("returns empty array if no generators", async () => {
      mockGuild.mockResolvedValue(null);
      const res = await request(app).get(
        `/api/guilds/${guild.id}/tempvc/generators`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("PATCH /api/guilds/:id/tempvc/:generatorId", () => {
    it("saves generator settings successfully", async () => {
      mockGetGenerator.mockResolvedValue({ id: "gen-1" });
      mockUpdateGenerator.mockResolvedValue({ id: "gen-1", bitrate: 128 });

      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/tempvc/gen-1`)
        .send({
          bitrate: 128,
          rtcRegion: "singapore",
          defaultName: "Room",
          userLimit: 5,
          templateId: "tmpl-1",
        });

      expect(res.status).toBe(200);
      expect(res.body.bitrate).toBe(128);
    });

    it("returns 404 if generator not found", async () => {
      mockGetGenerator.mockResolvedValue(null);
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/tempvc/gen-1`)
        .send({ bitrate: 128 });
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid bitrate", async () => {
      mockGetGenerator.mockResolvedValue({ id: "gen-1" });
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/tempvc/gen-1`)
        .send({ bitrate: 5 });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid rtcRegion", async () => {
      mockGetGenerator.mockResolvedValue({ id: "gen-1" });
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/tempvc/gen-1`)
        .send({ rtcRegion: "invalid-region" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid defaultName", async () => {
      mockGetGenerator.mockResolvedValue({ id: "gen-1" });
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/tempvc/gen-1`)
        .send({ defaultName: "" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid userLimit", async () => {
      mockGetGenerator.mockResolvedValue({ id: "gen-1" });
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/tempvc/gen-1`)
        .send({ userLimit: 100 });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/guilds/:id/tempvc", () => {
    it("returns general TempVC details", async () => {
      mockGuild.mockResolvedValue({
        generators: {},
        tempChannels: {
          "chan-1": { id: "chan-1", ownerId: "user-1", createdAt: Date.now() },
        },
      });

      const res = await request(app).get(`/api/guilds/${guild.id}/tempvc`);
      expect(res.status).toBe(200);
      expect(res.body.active_count).toBe(1);
    });
  });
});
