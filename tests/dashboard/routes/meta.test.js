const request = require("supertest");
const { createTestApp } = require("../../helpers/mockFactory");

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime_ms).toBe("number");
  });

  it("returns 503 when Discord WS disconnected", async () => {
    const { app } = createTestApp({ ws: { status: 1 } }); // not READY
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
  });
});

describe("GET /api/meta", () => {
  it("returns bot info shape", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/api/meta");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      bot_name: expect.any(String),
      status: expect.stringMatching(/^(online|offline)$/),
      uptime_ms: expect.any(Number),
      lavalink_status: expect.stringMatching(
        /connected|disconnected|connecting|reconnecting/,
      ),
      memory_rss_mb: expect.any(Number),
      memory_heap_mb: expect.any(Number),
      guild_count: expect.any(Number),
    });
  });
});

describe("GET /api/stats", () => {
  it("returns stats shape", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/api/stats");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      guild_count: expect.any(Number),
      user_count: expect.any(Number),
    });
  });
});

describe("PATCH /api/bot/presence", () => {
  it("sets presence and returns rotation_paused true", async () => {
    const { app, client } = createTestApp();
    const res = await request(app).patch("/api/bot/presence").send({
      status: "idle",
      activity_text: "Testing",
      activity_type: "playing",
    });
    expect(res.status).toBe(200);
    expect(res.body.rotation_paused).toBe(true);
    expect(client.user.setPresence).toHaveBeenCalled();
  });

  it("returns 400 on invalid status value", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .patch("/api/bot/presence")
      .send({ status: "invalid_status_value" });
    expect(res.status).toBe(400);
  });
});
