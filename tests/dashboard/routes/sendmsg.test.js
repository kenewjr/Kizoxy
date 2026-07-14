const request = require("supertest");
const {
  createTestApp,
  createMockGuild,
  createMockTextChannel,
} = require("../../helpers/mockFactory");

describe("Send Message Route Tests", () => {
  let app, guild, channel;

  beforeEach(() => {
    guild = createMockGuild();
    channel = createMockTextChannel({ guild });
    channel.permissionsFor = jest.fn().mockReturnValue({
      has: jest.fn().mockReturnValue(true),
    });
    guild.channels.cache.set(channel.id, channel);

    const clientOverrides = {
      guilds: {
        cache: new Map([[guild.id, guild]]),
      },
    };

    const setup = createTestApp(clientOverrides);
    app = setup.app;
  });

  describe("GET /api/sendmsg/channels/:guildId", () => {
    it("returns valid text channels of a guild", async () => {
      const res = await request(app).get(`/api/sendmsg/channels/${guild.id}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].id).toBe(channel.id);
      expect(res.body[0]).toHaveProperty("position");
    });

    it("returns 404 if guild not found", async () => {
      const res = await request(app).get("/api/sendmsg/channels/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/sendmsg/members/:guildId", () => {
    it("returns matching members of a guild", async () => {
      guild.members.cache.set("member-1", {
        id: "member-1",
        displayName: "Ken",
        user: { username: "ken" },
      });
      const res = await request(app).get(
        `/api/sendmsg/members/${guild.id}?q=ken`,
      );
      expect(res.status).toBe(200);
      expect(res.body[0]).toEqual({
        id: "member-1",
        username: "ken",
        display_name: "Ken",
      });
    });
  });

  describe("POST /api/sendmsg", () => {
    it("sends simple message successfully", async () => {
      const res = await request(app).post("/api/sendmsg").send({
        guild_id: guild.id,
        channel_id: channel.id,
        message: "Hello World!",
      });
      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(true);
      expect(channel.send).toHaveBeenCalled();
    });

    it("extracts mentions and sets allowedMentions.users strictly", async () => {
      const res = await request(app)
        .post("/api/sendmsg")
        .send({
          guild_id: guild.id,
          channel_id: channel.id,
          message: "Hello",
          mentions: ["111111111111111111", "222222222222222222"],
        });

      expect(res.status).toBe(200);
      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "<@111111111111111111> <@222222222222222222>\nHello",
          allowedMentions: {
            parse: [],
            users: ["111111111111111111", "222222222222222222"],
            roles: [],
          },
        }),
      );
    });

    it("sets allowedMentions.users empty when no mention tokens are present", async () => {
      const res = await request(app).post("/api/sendmsg").send({
        guild_id: guild.id,
        channel_id: channel.id,
        message: "Hello world without any pings",
      });

      expect(res.status).toBe(200);
      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Hello world without any pings",
          allowedMentions: {
            parse: [],
            users: [],
            roles: [],
          },
        }),
      );
    });

    it("returns 422 if discord send fails", async () => {
      channel.send.mockRejectedValueOnce(new Error("Discord API Error"));

      const res = await request(app).post("/api/sendmsg").send({
        guild_id: guild.id,
        channel_id: channel.id,
        message: "Hello",
      });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe("Discord API Error");
    });

    it("returns 400 if message and image_url are both missing", async () => {
      const res = await request(app).post("/api/sendmsg").send({
        guild_id: guild.id,
        channel_id: channel.id,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("message or image_url is required");
    });

    it("sends embed successfully", async () => {
      const res = await request(app).post("/api/sendmsg").send({
        guild_id: guild.id,
        channel_id: channel.id,
        as_embed: true,
        embed_title: "Announce Title",
        message: "Some description content",
      });

      expect(res.status).toBe(200);
      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        }),
      );
    });
  });
});
