const { createMockInteraction } = require("../helpers/mockFactory");
const {
  replySuccess,
  replyError,
  replyWarning,
  safeReply,
} = require("../../src/lib/interactions");

// Mock Embeds class/methods used in interactions
jest.mock("../../src/lib/embeds", () => ({
  success: () => ({ toJSON: () => ({ type: "success" }) }),
  error: () => ({ toJSON: () => ({ type: "error" }) }),
  warning: () => ({ toJSON: () => ({ type: "warning" }) }),
  info: () => ({ toJSON: () => ({ type: "info" }) }),
  formatError: (e) => e.message,
}));

describe("Interactions Lib Tests", () => {
  let interaction;

  beforeEach(() => {
    interaction = createMockInteraction();
  });

  describe("replySuccess", () => {
    it("calls reply or editReply on the interaction", async () => {
      await replySuccess(interaction, "Operation successful");
      expect(interaction.reply).toHaveBeenCalled();
    });
  });

  describe("replyError", () => {
    it("sets ephemeral: true by default", async () => {
      await replyError(interaction, "Failed task");
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          ephemeral: true,
        }),
      );
    });
  });

  describe("replyWarning", () => {
    it("calls reply with warning embed", async () => {
      await replyWarning(interaction, "Warning details");
      expect(interaction.reply).toHaveBeenCalled();
    });
  });

  describe("safeReply", () => {
    it("uses reply if not deferred or replied", async () => {
      await safeReply(interaction, { content: "test" });
      expect(interaction.reply).toHaveBeenCalled();
    });

    it("uses editReply if already deferred", async () => {
      interaction.deferred = true;
      await safeReply(interaction, { content: "test" });
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });
});
