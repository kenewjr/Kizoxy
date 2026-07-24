const { createMockInteraction } = require("../helpers/mockFactory");
const {
  replySuccess,
  replyError,
  replyWarning,
  replyInfo,
  safeReply,
  disableComponents,
  createCollector,
  confirmAction,
} = require("../../src/lib/interactions");

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

  describe("replyInfo", () => {
    it("calls reply with info embed", async () => {
      await replyInfo(interaction, "Info details");
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

    it("uses followUp if already replied", async () => {
      interaction.replied = true;
      await safeReply(interaction, { content: "test" });
      expect(interaction.followUp).toHaveBeenCalled();
    });
  });

  describe("disableComponents", () => {
    it("returns empty array if input is not array", () => {
      expect(disableComponents(null)).toEqual([]);
    });

    it("disables buttons and select menus", () => {
      const rows = [
        {
          components: [
            { type: 2, style: 1, toJSON: () => ({ type: 2, style: 1 }) }, // Button
            { type: 3, toJSON: () => ({ type: 3 }) }, // StringSelect
          ],
        },
      ];
      const disabled = disableComponents(rows);
      expect(disabled.length).toBe(1);
    });
  });

  describe("createCollector", () => {
    it("creates message component collector and handles end event", async () => {
      let endCallback;
      const mockCollector = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === "end") {
            endCallback = callback;
          }
        }),
      };
      const mockMessage = {
        createMessageComponentCollector: jest
          .fn()
          .mockReturnValue(mockCollector),
        components: [],
        edit: jest.fn().mockResolvedValue({}),
        reply: jest.fn().mockResolvedValue({}),
      };

      const col = createCollector(mockMessage);
      expect(col).toBeDefined();

      // Trigger callback manually
      await endCallback(new Map(), "time");
      expect(mockMessage.edit).toHaveBeenCalled();
      expect(mockMessage.reply).toHaveBeenCalled();
    });
  });

  describe("confirmAction", () => {
    it("handles timeout on awaitMessageComponent", async () => {
      interaction.id = "123";
      interaction.reply = jest.fn().mockResolvedValue({
        awaitMessageComponent: jest
          .fn()
          .mockRejectedValue(new Error("Timeout")),
      });

      const res = await confirmAction(interaction);
      expect(res).toBe("timeout");
    });

    it("handles confirm button click successfully", async () => {
      const click = {
        customId: "confirm_123",
        update: jest.fn().mockResolvedValue({}),
      };
      interaction.id = "123";
      interaction.reply = jest.fn().mockResolvedValue({
        awaitMessageComponent: jest.fn().mockResolvedValue(click),
      });

      const res = await confirmAction(interaction);
      expect(res).toBe("confirm");
      expect(click.update).toHaveBeenCalled();
    });

    it("handles cancel button click successfully", async () => {
      const click = {
        customId: "cancel_123",
        update: jest.fn().mockResolvedValue({}),
      };
      interaction.id = "123";
      interaction.reply = jest.fn().mockResolvedValue({
        awaitMessageComponent: jest.fn().mockResolvedValue(click),
      });

      const res = await confirmAction(interaction);
      expect(res).toBe("cancel");
    });
  });
});
