const { patchInteraction } = require("../../src/lib/patchInteractions");

describe("patchInteractions", () => {
  let mockPrototype;
  let mockInteraction;

  beforeEach(() => {
    mockPrototype = {
      reply: jest.fn().mockImplementation(function (options) {
        this.replied = true;
        if (options && options.ephemeral) {
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
    mockInteraction.id = "int-123";
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

  test("should support custom TTL", async () => {
    jest.useFakeTimers();
    await mockInteraction.reply({
      content: "test",
      ephemeral: true,
      ttl: 5000,
    });

    jest.advanceTimersByTime(4000);
    expect(mockInteraction.deleteReply).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2000);
    expect(mockInteraction.deleteReply).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test("should clear existing timeout on double reply", async () => {
    jest.useFakeTimers();
    await mockInteraction.reply({ content: "first", ephemeral: true });

    // Reply again, clearing original timeout
    await mockInteraction.reply({ content: "second", ephemeral: true });

    jest.advanceTimersByTime(15000);
    expect(mockInteraction.deleteReply).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test("should handle deleteReply throwing 10008 code errors gracefully", async () => {
    jest.useFakeTimers();
    mockInteraction.deleteReply.mockRejectedValue({
      code: 10008,
      message: "Unknown Message",
    });

    await mockInteraction.reply({ content: "test", ephemeral: true });
    jest.advanceTimersByTime(15000);

    // Should resolve without throwing
    jest.useRealTimers();
  });

  test("should log other deleteReply errors", async () => {
    jest.useFakeTimers();
    mockInteraction.deleteReply.mockRejectedValue(new Error("Network Error"));

    await mockInteraction.reply({ content: "test", ephemeral: true });
    jest.advanceTimersByTime(15000);

    // Should handle error gracefully
    jest.useRealTimers();
  });

  test("should handle null response / missing response id", async () => {
    jest.useFakeTimers();
    const customProto = {
      reply: jest.fn().mockResolvedValue(null),
      deleteReply: jest.fn().mockResolvedValue({}),
    };
    patchInteraction(customProto);
    const customInteraction = Object.create(customProto);
    customInteraction.id = "int-123";
    customInteraction.deleteReply = jest.fn().mockResolvedValue({});

    await customInteraction.reply({ content: "test", ephemeral: true });
    jest.advanceTimersByTime(15000);

    expect(customInteraction.deleteReply).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test("should handle followUp scheduling", async () => {
    jest.useFakeTimers();
    await mockInteraction.followUp({ content: "test", ephemeral: true });
    jest.advanceTimersByTime(15000);
    expect(mockInteraction.deleteReply).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test("should handle editReply scheduling", async () => {
    jest.useFakeTimers();
    mockInteraction.ephemeral = true;
    await mockInteraction.editReply({ content: "test" });
    jest.advanceTimersByTime(15000);
    expect(mockInteraction.deleteReply).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
