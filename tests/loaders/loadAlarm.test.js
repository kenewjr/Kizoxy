const loadAlarm = require("../../src/loaders/loadAlarm");
const { clearAlarmIntervals } = require("../../src/loaders/loadAlarm");
const JSONStorage = require("../../src/persistence/jsonStorage");
const AlarmScheduler = require("../../src/features/alarm/alarmScheduler");

jest.mock("../../src/persistence/jsonStorage");
jest.mock("../../src/features/alarm/alarmScheduler");
jest.mock("../../src/lib/logger");

describe("loadAlarm loader", () => {
  let client;

  beforeEach(() => {
    client = {
      once: jest.fn(),
      activeCountdowns: new Map(),
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearAlarmIntervals();
  });

  it("initializes alarm system and sets storage/scheduler on client", () => {
    loadAlarm(client);
    expect(client.alarmStorage).toBeInstanceOf(JSONStorage);
    expect(client.alarmScheduler).toBeInstanceOf(AlarmScheduler);
    expect(client.once).toHaveBeenCalledWith(
      "clientReady",
      expect.any(Function),
    );
  });

  it("runs the ready callback correctly and starts interval", async () => {
    loadAlarm(client);
    const readyCallback = client.once.mock.calls[0][1];

    const mockLoad = jest.fn().mockResolvedValue();
    client.alarmStorage.load = mockLoad;
    client.alarmScheduler.loadAlarms = jest.fn().mockResolvedValue();

    await readyCallback();
    expect(mockLoad).toHaveBeenCalled();
  });
});
