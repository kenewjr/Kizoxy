const Logger = require("../../utils/logger");

describe("Logger Utility", () => {
  let originalConsoleWarn;
  let originalConsoleError;

  beforeAll(() => {
    // Mock console methods to keep test output clean
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterAll(() => {
    // Restore console methods
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should create a logger with the correct module name", () => {
    const logger = new Logger("TEST_MODULE");
    expect(logger.moduleName).toBe("TEST_MODULE");
  });

  test("info() should call console.warn", () => {
    const logger = new Logger("TEST_MODULE");
    logger.info("Hello Info");
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn.mock.calls[0][0]).toContain("Hello Info");
    expect(console.warn.mock.calls[0][0]).toContain("TEST_MODULE");
  });

  test("error() should call console.error", () => {
    const logger = new Logger("TEST_MODULE");
    logger.error("Hello Error");
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error.mock.calls[0][0]).toContain("Hello Error");
    expect(console.error.mock.calls[0][0]).toContain("TEST_MODULE");
  });
});
