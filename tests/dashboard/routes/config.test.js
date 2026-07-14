const request = require("supertest");
const fs = require("fs");
const path = require("path");
const { createTestApp } = require("../../helpers/mockFactory");

describe("Config Route Tests", () => {
  let overridesPath;

  beforeAll(() => {
    overridesPath = path.join(__dirname, "../../../data/config_overrides.json");
  });

  beforeEach(() => {
    if (fs.existsSync(overridesPath)) {
      try {
        fs.unlinkSync(overridesPath);
      } catch (_) {}
    }
    jest.resetModules();
  });

  describe("GET /api/config", () => {
    it("returns the formatted safeConfig", async () => {
      const { app } = createTestApp();
      const res = await request(app).get("/api/config").expect(200);

      expect(res.body).toHaveProperty("bot");
      expect(res.body.bot).toHaveProperty("client_id");
      expect(res.body.bot).toHaveProperty("prefix");
      expect(res.body.bot).toHaveProperty("bot_color");
    });

    it("merges overrides accurately", async () => {
      fs.writeFileSync(
        overridesPath,
        JSON.stringify({ prefix: "custom!" }),
        "utf8",
      );

      // Load app after writing the overrides
      jest.resetModules();
      const { app } = createTestApp();

      const res = await request(app).get("/api/config").expect(200);

      expect(res.body.bot.prefix).toBe("custom!");
    });
  });

  describe("PATCH /api/config", () => {
    it("saves valid configurations and returns them", async () => {
      const { app } = createTestApp();
      const payload = {
        prefix: "new!",
        bot_color: "#ff0000",
        log_format: "json",
      };

      const res = await request(app)
        .patch("/api/config")
        .send(payload)
        .expect(200);

      expect(res.body.bot.prefix).toBe("new!");
      expect(res.body.bot.bot_color).toBe("#ff0000");

      const fileData = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
      expect(fileData.prefix).toBe("new!");
      expect(fileData.bot_color).toBe("#ff0000");
    });

    it("returns 400 on validation failure", async () => {
      const { app } = createTestApp();
      const payload = {
        bot_color: "invalid-hex",
      };

      const res = await request(app)
        .patch("/api/config")
        .send(payload)
        .expect(400);

      expect(res.body.error).toContain(
        "bot_color must be a valid hex color code",
      );
    });

    it("returns 403 when trying to update read-only fields", async () => {
      const { app } = createTestApp();
      const payload = {
        DISCORD_TOKEN: "some-token",
      };

      const res = await request(app)
        .patch("/api/config")
        .send(payload)
        .expect(403);

      expect(res.body.error).toContain("Field is read-only at runtime");
    });
  });
});
