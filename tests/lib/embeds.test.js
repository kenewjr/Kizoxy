const { createMockClient } = require("../helpers/mockFactory");
const Embeds = require("../../src/lib/embeds");

describe("Embeds Utility Tests", () => {
  let client;

  beforeEach(() => {
    client = createMockClient();
  });

  describe("truncate", () => {
    it("truncates string exceeding limit and appends default suffix", () => {
      const longStr = "a".repeat(300);
      const res = Embeds.truncate(longStr, 10);
      expect(res.length).toBe(10);
      expect(res.endsWith("…")).toBe(true);
    });

    it("keeps short strings unchanged", () => {
      expect(Embeds.truncate("hello", 10)).toBe("hello");
    });
  });

  describe("truncateDescription", () => {
    it("applies softCap limit of 2048 characters by default", () => {
      const longText = "a".repeat(2500);
      const res = Embeds.truncateDescription(longText, { softCap: true });
      expect(res.length).toBe(2048);
      expect(res).toContain("*(truncated)*");
    });

    it("includes readMoreUrl if provided during truncation", () => {
      const longText = "a".repeat(2500);
      const res = Embeds.truncateDescription(longText, {
        softCap: true,
        readMoreUrl: "https://readmore",
      });
      expect(res).toContain("[Read more](https://readmore)");
    });
  });

  describe("Embed Builders", () => {
    it("creates EmbedBuilder via success method", () => {
      const embed = Embeds.success(client, {
        description: "All systems green",
      });
      const data = embed.toJSON();
      expect(data.color).toBe(Embeds.COLORS.SUCCESS);
      expect(data.description).toContain("✅ All systems green");
      expect(data.footer.text).toBe("Kizoxy");
    });

    it("creates EmbedBuilder via error method", () => {
      const embed = Embeds.error(client, { description: "Failure" });
      const data = embed.toJSON();
      expect(data.color).toBe(Embeds.COLORS.ERROR);
      expect(data.description).toContain("❌ Failure");
    });

    it("creates EmbedBuilder via warning method", () => {
      const embed = Embeds.warning(client, { description: "Warning message" });
      const data = embed.toJSON();
      expect(data.color).toBe(Embeds.COLORS.WARNING);
      expect(data.description).toContain("⚠️ Warning message");
    });

    it("creates EmbedBuilder via music/brand/withColor methods", () => {
      expect(
        Embeds.music(client, { description: "Music" }).toJSON().color,
      ).toBe(Embeds.COLORS.MUSIC);
      expect(
        Embeds.brand(client, { description: "Brand" }).toJSON().color,
      ).toBe(5793266);
      expect(
        Embeds.withColor(client, 12345, { description: "Custom" }).toJSON()
          .color,
      ).toBe(12345);
    });
  });

  describe("formatError", () => {
    it("returns default message for null", () => {
      expect(Embeds.formatError(null)).toContain("unknown error");
    });

    it("returns string as-is", () => {
      expect(Embeds.formatError("Direct error")).toBe("Direct error");
    });

    it("formats error object message", () => {
      const err = new TypeError("Invalid argument");
      expect(Embeds.formatError(err)).toBe("Invalid argument");
    });
  });
});
