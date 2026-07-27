const mockInfo = jest.fn();
const mockSuccess = jest.fn();
const mockWarning = jest.fn();
const mockError = jest.fn();
const mockDebug = jest.fn();

jest.mock("../../../src/lib/logger", () => {
  return jest.fn().mockImplementation(() => ({
    info: mockInfo,
    success: mockSuccess,
    warning: mockWarning,
    error: mockError,
    debug: mockDebug,
  }));
});

const closeEvent = require("../../../src/events/player/close");
const debugEvent = require("../../../src/events/player/debug");
const disconnectEvent = require("../../../src/events/player/disconnect");
const errorEvent = require("../../../src/events/player/error");

describe("Player Events Hardening", () => {
  let client;

  beforeEach(() => {
    client = {};
    mockInfo.mockClear();
    mockSuccess.mockClear();
    mockWarning.mockClear();
    mockError.mockClear();
    mockDebug.mockClear();
  });

  describe("close.js", () => {
    it("logs warning if code is less than 4000", async () => {
      await closeEvent(client, "nodeA", 1000, "Normal closure");
      expect(mockWarning).toHaveBeenCalledWith(
        "Node nodeA: Connection closed - Code 1000, Reason: Normal closure",
      );
    });

    it("logs error if code is 4000 or greater", async () => {
      await closeEvent(client, "nodeB", 4001, "Abnormal closure");
      expect(mockError).toHaveBeenCalledWith(
        "Node nodeB: Connection closed abnormally - Code 4001, Reason: Abnormal closure",
      );
    });

    it("uses default reason if none provided", async () => {
      await closeEvent(client, "nodeC", 1000, null);
      expect(mockWarning).toHaveBeenCalledWith(
        "Node nodeC: Connection closed - Code 1000, Reason: No reason provided",
      );
    });
  });

  describe("debug.js", () => {
    it("logs debug info if meaningful", async () => {
      await debugEvent(client, "nodeA", "Some debug message");
      expect(mockDebug).toHaveBeenCalledWith("Node nodeA: Some debug message");
    });

    it("does not log if info is empty/whitespace", async () => {
      await debugEvent(client, "nodeA", "   ");
      expect(mockDebug).not.toHaveBeenCalled();
    });
  });

  describe("disconnect.js", () => {
    it("logs debug and returns if moved is true", async () => {
      const players = [];
      await disconnectEvent(client, "nodeA", players, true);
      expect(mockDebug).toHaveBeenCalledWith(
        "Node nodeA: Moved to different server",
      );
      expect(mockWarning).not.toHaveBeenCalled();
    });

    it("disconnects all players and logs warning if moved is false", async () => {
      const mockPlayer = {
        connection: {
          disconnect: jest.fn(),
        },
      };
      await disconnectEvent(client, "nodeA", [mockPlayer], false);
      expect(mockPlayer.connection.disconnect).toHaveBeenCalledTimes(1);
      expect(mockWarning).toHaveBeenCalledWith(
        "Node nodeA: Disconnected from Lavalink server",
      );
    });
  });

  describe("error.js", () => {
    it("logs error message", async () => {
      await errorEvent(client, "nodeA", new Error("Fatal crash"));
      expect(mockError).toHaveBeenCalledWith(
        "Node nodeA: Error occurred - Fatal crash",
      );
    });

    it("logs error stack if available", async () => {
      const err = new Error("Fatal crash");
      err.stack = "stacktrace123";
      await errorEvent(client, "nodeA", err);
      expect(mockDebug).toHaveBeenCalledWith("Stack trace: stacktrace123");
    });

    it("logs raw error string if no message/object", async () => {
      await errorEvent(client, "nodeA", "Fatal string error");
      expect(mockError).toHaveBeenCalledWith(
        "Node nodeA: Error occurred - Fatal string error",
      );
    });
  });
});
