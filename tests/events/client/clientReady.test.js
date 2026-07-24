const fs = require("fs");
const path = require("path");
const clientReady = require("../../../src/events/client/clientReady");
const { createMockClient } = require("../../helpers/mockFactory");

describe("clientReady Event Tests", () => {
  let client;
  const overridesPath = path.join(
    __dirname,
    "../../../data/config_overrides.json",
  );

  beforeEach(() => {
    client = createMockClient();
    client.guilds.cache.size = 5;
    client.guilds.cache.reduce = (fn, acc) => fn(acc, { memberCount: 10 });
    jest.useFakeTimers();
    if (fs.existsSync(overridesPath)) {
      try {
        fs.unlinkSync(overridesPath);
      } catch (_) {}
    }
  });

  afterEach(() => {
    jest.useRealTimers();
    if (fs.existsSync(overridesPath)) {
      try {
        fs.unlinkSync(overridesPath);
      } catch (_) {}
    }
  });

  it("successfully launches activity rotation and logs bot ready", async () => {
    await clientReady(client);
    expect(client.user.setActivity).toHaveBeenCalled();

    // Trigger timer interval
    jest.advanceTimersByTime(60000);
    expect(client.user.setActivity).toHaveBeenCalledTimes(2);
  });

  it("handles pause and resume features", () => {
    clientReady.pausePresenceRotation();
    expect(clientReady.isRotationPaused()).toBe(true);

    clientReady.resumePresenceRotation();
    expect(clientReady.isRotationPaused()).toBe(false);
  });

  it("loads overrides file and custom activities if present", async () => {
    const configData = {
      rotation_paused: true,
      custom_activities: [
        { text: "Custom Playing Text", type: "playing" },
        { text: "Custom Watching Text", type: "watching" },
        { text: "Custom Listening Text", type: "listening" },
        { text: "Custom Competing Text", type: "competing" },
        { text: "Default Mapping", type: "unknown" },
      ],
    };
    fs.mkdirSync(path.dirname(overridesPath), { recursive: true });
    fs.writeFileSync(overridesPath, JSON.stringify(configData), "utf8");

    await clientReady(client);
    expect(client.user.setActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Custom Playing Text",
      }),
    );

    clientReady.resumePresenceRotation();
    // Test interval cycle with custom list
    jest.advanceTimersByTime(60000);
    expect(client.user.setActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Custom Watching Text",
      }),
    );
  });

  it("handles malformed JSON in overrides file", async () => {
    fs.mkdirSync(path.dirname(overridesPath), { recursive: true });
    fs.writeFileSync(overridesPath, "{ malformed...", "utf8");

    await clientReady(client);
    expect(client.user.setActivity).toHaveBeenCalled();
  });
});
