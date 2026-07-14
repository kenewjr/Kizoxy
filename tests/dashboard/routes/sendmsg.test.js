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
    it("returns text channels of a guild", async () => {
      const res = await request(app).get(`/api/sendmsg/channels/${guild.id}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].id).toBe(channel.id);
    });

    it("returns 404 if guild not found", async () => {
      const res = await request(app).get("/api/sendmsg/channels/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/sendmsg/members/:guildId", () => {
    it("returns filtered members list", async () => {
      const mockMember = {
        id: "member-1",
        displayName: "John Doe",
        user: {
          username: "johndoe",
          bot: false,
          displayAvatarURL: () => "avatar-url",
        },
      };
      guild.members.cache.set(mockMember.id, mockMember);

      const res = await request(app).get(
        `/api/sendmsg/members/${guild.id}?q=John`,
      );
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].username).toBe("johndoe");
    });

    it("returns empty array if guild not found", async () => {
      const res = await request(app).get("/api/sendmsg/members/nonexistent");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("returns empty array on members fetch failure", async () => {
      guild.members.fetch.mockRejectedValueOnce(new Error("Discord API Error"));
      const res = await request(app).get(
        `/api/sendmsg/members/${guild.id}?q=fetchfail`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
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
      expect(res.body.success).toBe(true);
      expect(channel.send).toHaveBeenCalled();
    });

    it("sends message with embed options successfully", async () => {
      const res = await request(app).post("/api/sendmsg").send({
        guild_id: guild.id,
        channel_id: channel.id,
        message: "Embed text",
        embed: true,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        }),
      );
    });

    it("returns 400 if message content is empty and no image provided", async () => {
      const res = await request(app)
        .post("/api/sendmsg")
        .send({ guild_id: guild.id, channel_id: channel.id, message: "" });
      expect(res.status).toBe(400);
    });

    it("returns 400 if message exceeds 2000 characters", async () => {
      const res = await request(app)
        .post("/api/sendmsg")
        .send({
          guild_id: guild.id,
          channel_id: channel.id,
          message: "a".repeat(2001),
        });
      expect(res.status).toBe(400);
    });

    it("returns 422 if channel.send throws permissions error", async () => {
      channel.send.mockRejectedValueOnce(new Error("Missing Access"));
      const res = await request(app).post("/api/sendmsg").send({
        guild_id: guild.id,
        channel_id: channel.id,
        message: "Hello!",
      });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe("Missing Access");
    });
  });
});
