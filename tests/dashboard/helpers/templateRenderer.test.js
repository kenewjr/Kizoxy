const {
  renderTemplate,
} = require("../../../src/dashboard/helpers/templateRenderer");
const {
  buildContent,
  MAX_CONTENT,
} = require("../../../src/lib/notificationTemplate");

describe("Template Renderer Helper Tests", () => {
  describe("renderTemplate", () => {
    it("replaces placeholders with matching variable values", () => {
      const template = "Hello {name}, welcome to {place}!";
      const vars = { name: "Alice", place: "Wonderland" };
      expect(renderTemplate(template, vars)).toBe(
        "Hello Alice, welcome to Wonderland!",
      );
    });

    it("renders unknown/missing placeholders as empty strings", () => {
      const template = "Hello {name}, welcome to {place}!";
      const vars = { name: "Alice" };
      expect(renderTemplate(template, vars)).toBe("Hello Alice, welcome to !");
    });
  });

  describe("buildContent", () => {
    const defaultPrefix = "default prefix text";
    const vars = { name: "Creator", url: "https://video", title: "New Video" };

    it("falls back to defaultPrefix with ping if customMessage is empty", () => {
      const res = buildContent({
        customMessage: "",
        mentionRoleId: "12345",
        defaultPrefix,
        vars,
      });
      expect(res).toBe("<@&12345> default prefix text");
    });

    it("uses customMessage template replacing placeholders correctly", () => {
      const res = buildContent({
        customMessage: "New upload from {name}: {title} at {url}",
        mentionRoleId: null,
        defaultPrefix,
        vars,
      });
      expect(res).toBe("New upload from Creator: New Video at https://video");
    });

    it("prepends role mention if mentionRoleId is set but {role} is omitted in customMessage", () => {
      const res = buildContent({
        customMessage: "Check out {title}",
        mentionRoleId: "12345",
        defaultPrefix,
        vars,
      });
      expect(res).toBe("<@&12345> Check out New Video");
    });

    it("replaces {role} inline if explicitly referenced inside customMessage", () => {
      const res = buildContent({
        customMessage: "{role} look at {title}",
        mentionRoleId: "12345",
        defaultPrefix,
        vars,
      });
      expect(res).toBe("<@&12345> look at New Video");
    });

    it("clamps output content to MAX_CONTENT length limit", () => {
      const longMessage = "a".repeat(MAX_CONTENT + 10);
      const res = buildContent({
        customMessage: longMessage,
        mentionRoleId: null,
        defaultPrefix,
        vars,
      });
      expect(res.length).toBe(MAX_CONTENT);
    });
  });
});
