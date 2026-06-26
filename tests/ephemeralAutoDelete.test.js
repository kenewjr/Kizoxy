const { patchInteraction } = require("../src/lib/patchInteractions");
const { scheduleAutoDelete } = require("../src/features/music/musicHelper");
const { getEphemeralStats } = require("../src/lib/ephemeralStats");
const Logger = require("../src/lib/logger");
const { EPHEMERAL_AUTO_DELETE_MS } = require("../src/config/constants");

describe("Ephemeral Auto-Delete Systems Reconciliation", () => {
  let mockPrototype;
  let mockInteraction;
  let loggerErrorSpy;
  let loggerDebugSpy;

  beforeEach(() => {
    jest.useFakeTimers();

    // Spy on logger
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});
    loggerDebugSpy = jest
      .spyOn(Logger.prototype, "debug")
      .mockImplementation(() => {});

    // Create a mock prototype for interaction targets
    mockPrototype = {
      reply: jest.fn().mockImplementation(function (options) {
        this.replied = true;
        if (options.ephemeral) {
          this.ephemeral = true;
        }
        return Promise.resolve({ id: "mock-msg-123" });
      }),
      followUp: jest.fn().mockImplementation(function () {
        return Promise.resolve({ id: "mock-followup-123" });
      }),
      editReply: jest.fn().mockImplementation(function () {
        return Promise.resolve({ id: "mock-msg-123" });
      }),
    };

    patchInteraction(mockPrototype);

    mockInteraction = Object.create(mockPrototype);
    mockInteraction.replied = false;
    mockInteraction.deferred = false;
    mockInteraction.ephemeral = false;
    mockInteraction.deleteReply = jest.fn().mockResolvedValue({});
    mockInteraction.id = "test-interaction-id";
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
    loggerDebugSpy.mockRestore();
    jest.useRealTimers();
  });

  test("ephemeral + no components -> timer scheduled at EPHEMERAL_AUTO_DELETE_MS, deleteReply called exactly once", async () => {
    const statsBefore = getEphemeralStats().scheduled;
    await mockInteraction.reply({ content: "test success", ephemeral: true });

    expect(getEphemeralStats().scheduled).toBe(statsBefore + 1);
    expect(mockInteraction.deleteReply).not.toHaveBeenCalled();

    // Advance right before default timeout
    jest.advanceTimersByTime(EPHEMERAL_AUTO_DELETE_MS - 1);
    expect(mockInteraction.deleteReply).not.toHaveBeenCalled();

    // Advance to fire
    jest.advanceTimersByTime(1);
    // Flush microtasks since callback is async
    await Promise.resolve();
    expect(mockInteraction.deleteReply).toHaveBeenCalledTimes(1);
  });

  test("ephemeral + components -> NOT scheduled", async () => {
    const statsBefore = getEphemeralStats().scheduled;
    await mockInteraction.reply({
      content: "with components",
      ephemeral: true,
      components: [{ type: 1, components: [] }],
    });

    expect(getEphemeralStats().scheduled).toBe(statsBefore);

    jest.advanceTimersByTime(EPHEMERAL_AUTO_DELETE_MS);
    expect(mockInteraction.deleteReply).not.toHaveBeenCalled();
  });

  test("non-ephemeral -> NOT scheduled", async () => {
    const statsBefore = getEphemeralStats().scheduled;
    await mockInteraction.reply({
      content: "not ephemeral",
      ephemeral: false,
    });

    expect(getEphemeralStats().scheduled).toBe(statsBefore);

    jest.advanceTimersByTime(EPHEMERAL_AUTO_DELETE_MS);
    expect(mockInteraction.deleteReply).not.toHaveBeenCalled();
  });

  test("deleteReply rejecting with code 10008 -> swallowed, no unhandled rejection, no logger.error call", async () => {
    const error10008 = new Error("Unknown Message");
    error10008.code = 10008;
    mockInteraction.deleteReply = jest.fn().mockRejectedValue(error10008);

    await mockInteraction.reply({ content: "error case", ephemeral: true });

    // Trigger timeout
    jest.advanceTimersByTime(EPHEMERAL_AUTO_DELETE_MS);
    // Flush microtasks since callback is async
    await Promise.resolve();
    await Promise.resolve();

    expect(mockInteraction.deleteReply).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerDebugSpy).toHaveBeenCalled();
  });

  test("the task-2 guard -> triggering scheduleAutoDelete on a reply already covered by the universal patch does not register a second timer", async () => {
    const statsBefore = getEphemeralStats().scheduled;

    // First, trigger universal patch via reply
    await mockInteraction.reply({ content: "guarded", ephemeral: true });
    expect(mockInteraction._kizoxyAutoDeleteScheduled).toBe(true);
    expect(getEphemeralStats().scheduled).toBe(statsBefore + 1);

    // Call scheduleAutoDelete on the same interaction - should be blocked by guard
    scheduleAutoDelete(mockInteraction, 5000);
    expect(getEphemeralStats().scheduled).toBe(statsBefore + 1); // No new scheduled stats

    // Advance time and check deleteReply is only called once
    jest.advanceTimersByTime(EPHEMERAL_AUTO_DELETE_MS + 5000);
    await Promise.resolve();
    await Promise.resolve();
    expect(mockInteraction.deleteReply).toHaveBeenCalledTimes(1);
  });
});
