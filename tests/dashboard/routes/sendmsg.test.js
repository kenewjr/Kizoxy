const request = require("supertest");
const { PermissionFlagsBits } = require("discord.js");
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

  describe("GET /api/guilds/:guildId/send-message/members", () => {
    it("returns filtered members list", async () => {
      const mockMember = {
        id: "123456789012345678",
        displayName: "John Doe",
        user: {
          username: "johndoe",
          bot: false,
          displayAvatarURL: () => "avatar-url",
        },
      };
      guild.members.cache.set(mockMember.id, mockMember);

      const res = await request(app).get(
        `/api/guilds/${guild.id}/send-message/members?q=John`,
      );
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].username).toBe("johndoe");
    });

    it("returns 404 if guild not found", async () => {
      const res = await request(app).get(
        "/api/guilds/nonexistent/send-message/members",
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/guilds/:guildId/send-message", () => {
    it("sends simple message successfully", async () => {
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/send-message`)
        .send({
          channelId: channel.id,
          message: "Hello World!",
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(channel.send).toHaveBeenCalled();
    });

    it("pings users and roles in correctly structured content", async () => {
      const mockUser = {
        id: "111111111111111111",
        displayName: "UserOne",
        user: {
          username: "userone",
          bot: false,
          displayAvatarURL: () => "avatar",
        },
      };
      guild.members.cache.set(mockUser.id, mockUser);

      const mockRole = {
        id: "222222222222222222",
        name: "RoleOne",
      };
      guild.roles.cache.set(mockRole.id, mockRole);

      const res = await request(app)
        .post(`/api/guilds/${guild.id}/send-message`)
        .send({
          channelId: channel.id,
          message: "Main text",
          mentionUsers: [mockUser.id],
          mentionRoles: [mockRole.id],
          mentionEveryone: true,
        });

      expect(res.status).toBe(200);
      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content:
            "@everyone\n<@111111111111111111>\n<@&222222222222222222>\nMain text",
          allowedMentions: expect.objectContaining({
            parse: ["everyone"],
            users: [mockUser.id],
            roles: [mockRole.id],
          }),
        }),
      );
    });

    it("returns 400 if user mention does not belong to guild", async () => {
      guild.members.fetch.mockRejectedValueOnce(new Error("Not found"));
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/send-message`)
        .send({
          channelId: channel.id,
          message: "Hello",
          mentionUsers: ["999999999999999999"],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("does not belong to this guild");
    });

    it("returns 400 if role mention does not belong to guild", async () => {
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/send-message`)
        .send({
          channelId: channel.id,
          message: "Hello",
          mentionRoles: ["999999999999999999"],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("does not belong to this guild");
    });

    it("returns 403 if bot lacks ViewChannel or SendMessages permissions", async () => {
      const mockPerms = {
        has: jest.fn().mockReturnValue(false),
      };
      channel.permissionsFor.mockReturnValue(mockPerms);

      const res = await request(app)
        .post(`/api/guilds/${guild.id}/send-message`)
        .send({
          channelId: channel.id,
          message: "Hello",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain(
        "Bot does not have View Channel or Send Messages permissions",
      );
    });

    it("returns 403 if bot lacks MentionEveryone permission when requested", async () => {
      const mockPerms = {
        has: jest.fn().mockImplementation((perm) => {
          if (
            perm === PermissionFlagsBits.ViewChannel ||
            perm === PermissionFlagsBits.SendMessages
          ) {
            return true;
          }
          return false;
        }),
      };
      channel.permissionsFor.mockReturnValue(mockPerms);

      const res = await request(app)
        .post(`/api/guilds/${guild.id}/send-message`)
        .send({
          channelId: channel.id,
          message: "Hello",
          mentionEveryone: true,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain(
        "Bot does not have Mention Everyone permission",
      );
    });

    it("returns 400 if message content is empty and no attachments exist", async () => {
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/send-message`)
        .send({
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
        .post(`/api/guilds/${guild.id}/send-message`)
        .send({
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

    it("sends base64 attachments successfully", async () => {
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/send-message`)
        .send({
          channelId: channel.id,
          message: "See attached",
          attachments: [
            {
              name: "test.txt",
              data: "SGVsbG8gV29ybGQ=", // "Hello World"
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.any(Array),
        }),
      );
      const args = channel.send.mock.calls[0][0];
      expect(args.files[0].name).toBe("test.txt");
      expect(args.files[0].attachment.toString("utf8")).toBe("Hello World");
    });

    it("returns 400 if base64 attachments exceed 8MB", async () => {
      const largeBase64 = "a".repeat(12 * 1024 * 1024); // approx 12MB string = 9MB buffer
      const res = await request(app)
        .post(`/api/guilds/${guild.id}/send-message`)
        .send({
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
