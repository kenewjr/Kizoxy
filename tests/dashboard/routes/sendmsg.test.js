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
    });

    it("returns 404 if guild not found", async () => {
      const res = await request(app).get("/api/sendmsg/channels/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/sendmsg", () => {
    it("sends simple message successfully", async () => {
      const res = await request(app).post("/api/sendmsg").send({
        guildId: guild.id,
        channelId: channel.id,
        message: "Hello World!",
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(channel.send).toHaveBeenCalled();
    });

    it("extracts <@id> tokens and sets allowedMentions.users strictly", async () => {
      const res = await request(app).post("/api/sendmsg").send({
        guildId: guild.id,
        channelId: channel.id,
        message: "Hello <@111111111111111111> and <@!222222222222222222>",
      });

      expect(res.status).toBe(200);
      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Hello <@111111111111111111> and <@!222222222222222222>",
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
        guildId: guild.id,
        channelId: channel.id,
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

    it("returns 403 if bot lacks SendMessages or ViewChannel permissions", async () => {
      channel.permissionsFor.mockReturnValueOnce({
        has: jest.fn().mockReturnValue(false),
      });

      const res = await request(app).post("/api/sendmsg").send({
        guildId: guild.id,
        channelId: channel.id,
        message: "Hello",
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain(
        "Bot does not have View Channel or Send Messages permissions",
      );
    });

    it("returns 400 for non-text channels", async () => {
      channel.type = 2; // GuildVoice
      const res = await request(app).post("/api/sendmsg").send({
        guildId: guild.id,
        channelId: channel.id,
        message: "Hello",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain(
        "Channel is not a text channel or compatible thread",
      );
    });

    it("returns 400 if message content is empty and no attachments exist", async () => {
      const res = await request(app).post("/api/sendmsg").send({
        guildId: guild.id,
        channelId: channel.id,
        message: "",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain(
        "Message content or attachments are required",
      );
    });

    it("sends embed successfully", async () => {
      const res = await request(app)
        .post("/api/sendmsg")
        .send({
          guildId: guild.id,
          channelId: channel.id,
          messageType: "embed",
          embed: {
            title: "Announce Title",
            description: "Some description content",
            color: "#ff0000",
          },
        });

      expect(res.status).toBe(200);
      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        }),
      );
    });

    it("returns 400 if base64 attachments exceed 8MB", async () => {
      const largeBase64 = "a".repeat(12 * 1024 * 1024); // approx 9MB buffer
      const res = await request(app)
        .post("/api/sendmsg")
        .send({
          guildId: guild.id,
          channelId: channel.id,
          message: "Too big",
          attachments: [
            {
              name: "big.txt",
              data: largeBase64,
            },
          ],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Attachments exceed size limit of 8MB");
    });
  });
});
