const Logger = require("../../src/lib/logger");

describe("Logger Lib Tests", () => {
  let logSpy, warnSpy, errorSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("logs info messages to console.log", () => {
    const logger = new Logger("TEST");
    logger.info("Info message");
    expect(logSpy).toHaveBeenCalled();
  });

  it("logs warning messages to console.warn", () => {
    const logger = new Logger("TEST");
    logger.warning("Warning message");
    expect(warnSpy).toHaveBeenCalled();
  });

  it("logs error messages to console.error", () => {
    const logger = new Logger("TEST");
    logger.error("Error message");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("logs debug messages", () => {
    const logger = new Logger("TEST");
    logger.debug("Debug message");
    expect(logSpy).toHaveBeenCalled();
  });
});
