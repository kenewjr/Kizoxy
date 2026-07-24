const request = require("supertest");
const { createTestApp, createMockGuild } = require("../../helpers/mockFactory");

const mockUpdateAlarm = jest.fn();
const mockCancelAlarm = jest.fn();

jest.mock("../../../src/features/alarm/alarmService", () => ({
  updateAlarm: (...args) => mockUpdateAlarm(...args),
  cancelAlarm: (...args) => mockCancelAlarm(...args),
}));

describe("Guild Alarms Router Tests", () => {
  let app, guild, alarmStorageMock;

  beforeEach(() => {
    guild = createMockGuild();
    alarmStorageMock = {
      get: jest.fn(),
    };

    const setup = createTestApp({
      guilds: {
        cache: new Map([[guild.id, guild]]),
      },
      alarmStorage: alarmStorageMock,
    });
    app = setup.app;
    mockUpdateAlarm.mockReset();
    mockCancelAlarm.mockReset();
  });

  describe("PATCH /api/guilds/:id/alarms/:alarmId", () => {
    it("updates alarm successfully", async () => {
      alarmStorageMock.get.mockResolvedValue({
        id: "alarm-1",
        guildId: guild.id,
      });
      mockUpdateAlarm.mockResolvedValue({
        alarm: { id: "alarm-1", message: "updated" },
      });

      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/alarms/alarm-1`)
        .send({ message: "updated" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("updated");
    });

    it("returns 404 if alarm not found", async () => {
      alarmStorageMock.get.mockResolvedValue(null);
      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/alarms/alarm-1`)
        .send({ message: "updated" });
      expect(res.status).toBe(404);
    });

    it("returns 422 if updateAlarm returns error", async () => {
      alarmStorageMock.get.mockResolvedValue({
        id: "alarm-1",
        guildId: guild.id,
      });
      mockUpdateAlarm.mockResolvedValue({ error: "Invalid time format" });

      const res = await request(app)
        .patch(`/api/guilds/${guild.id}/alarms/alarm-1`)
        .send({ time: "99:99" });

      expect(res.status).toBe(422);
    });
  });

  describe("DELETE /api/guilds/:id/alarms/:alarmId", () => {
    it("cancels alarm successfully", async () => {
      alarmStorageMock.get.mockResolvedValue({
        id: "alarm-1",
        guildId: guild.id,
      });
      mockCancelAlarm.mockResolvedValue(true);

      const res = await request(app).delete(
        `/api/guilds/${guild.id}/alarms/alarm-1`,
      );
      expect(res.status).toBe(200);
      expect(res.body.cancelled).toBe(true);
    });

    it("returns 404 if alarm not found", async () => {
      alarmStorageMock.get.mockResolvedValue(null);
      const res = await request(app).delete(
        `/api/guilds/${guild.id}/alarms/alarm-1`,
      );
      expect(res.status).toBe(404);
    });
  });
});
