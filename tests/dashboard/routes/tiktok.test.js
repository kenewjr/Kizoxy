const express = require("express");
const request = require("supertest");

jest.mock("../../../src/persistence/tiktokStorage", () => ({
  listSubscriptions: jest.fn(),
}));

jest.mock("../../../src/integrations/tiktok/client", () => ({
  fetchProfile: jest.fn(),
  TiktokAccountNotFoundError: class extends Error {},
}));

jest.mock("../../../src/integrations/tiktok/resolver", () => ({
  resolveProfile: jest.fn(),
}));

const tiktokStorage = require("../../../src/persistence/tiktokStorage");
const tiktokClient = require("../../../src/integrations/tiktok/client");
const tiktokRouter = require("../../../src/dashboard/routes/tiktok");

describe("GET /api/guilds/:id/tiktok/:subId/check", () => {
  it("returns the scraper diagnostic for an empty profile", async () => {
    tiktokStorage.listSubscriptions.mockResolvedValue([
      { id: "sub-1", username: "restricteduser" },
    ]);
    tiktokClient.fetchProfile.mockResolvedValue({
      user: {
        username: "restricteduser",
        avatar: null,
        live: false,
        liveId: null,
        liveUrl: "https://www.tiktok.com/@restricteduser/live",
      },
      videos: [],
      diagnostic: "browser captured 0 items across 2 API responses",
    });
    const app = express();
    app.use("/api/guilds", tiktokRouter);

    const response = await request(app)
      .get("/api/guilds/guild-1/tiktok/sub-1/check")
      .expect(200);

    expect(response.body).toMatchObject({
      username: "restricteduser",
      total_videos_fetched: 0,
      latest_video: null,
      diagnostic: "browser captured 0 items across 2 API responses",
    });
  });
});
