const { patchInteraction } = require("../../src/lib/patchInteractions");

describe("patchInteractions", () => {
  let mockPrototype;
  let mockInteraction;

  beforeEach(() => {
    mockPrototype = {
      reply: jest.fn().mockImplementation(function (options) {
        this.replied = true;
        if (options.ephemeral) {
          this.ephemeral = true;
        }
        return Promise.resolve({ id: "mock-message-id" });
      }),
      followUp: jest.fn().mockImplementation(function () {
        return Promise.resolve({ id: "mock-followup-id" });
      }),
      editReply: jest.fn().mockImplementation(function () {
        return Promise.resolve({ id: "mock-message-id" });
      }),
    };

    patchInteraction(mockPrototype);

    mockInteraction = Object.create(mockPrototype);
    mockInteraction.replied = false;
    mockInteraction.deferred = false;
    mockInteraction.ephemeral = false;
    mockInteraction.deleteReply = jest.fn().mockResolvedValue({});
  });

  test("should schedule deletion for ephemeral replies without components", async () => {
    jest.useFakeTimers();

    await mockInteraction.reply({ content: "test", ephemeral: true });

    expect(mockInteraction.deleteReply).not.toHaveBeenCalled();

    jest.advanceTimersByTime(15000);

    expect(mockInteraction.deleteReply).toHaveBeenCalledWith("mock-message-id");
    jest.useRealTimers();
  });

  test("should NOT schedule deletion if components are present", async () => {
    jest.useFakeTimers();

    await mockInteraction.reply({
      content: "test",
      ephemeral: true,
      components: [{ type: 1 }],
    });

    jest.advanceTimersByTime(15000);

    expect(mockInteraction.deleteReply).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test("should NOT schedule deletion if not ephemeral", async () => {
    jest.useFakeTimers();

    await mockInteraction.reply({ content: "test", ephemeral: false });

    jest.advanceTimersByTime(15000);

    expect(mockInteraction.deleteReply).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
