const express = require("express");
const request = require("supertest");

jest.mock("../../../src/integrations/scraperService/client", () => ({
  getProxyStatus: jest.fn(),
  rotateProxy: jest.fn(),
  setProxyMode: jest.fn(),
  setProxyListSource: jest.fn(),
}));

const scraperService = require("../../../src/integrations/scraperService/client");
const proxyRouter = require("../../../src/dashboard/routes/proxy");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/guilds", proxyRouter);
  return app;
}

const cases = [
  {
    name: "status",
    method: "get",
    path: "/api/guilds/guild-1/proxy/status",
    service: "getProxyStatus",
    expectedArgs: [],
  },
  {
    name: "rotation",
    method: "post",
    path: "/api/guilds/guild-1/proxy/rotate",
    service: "rotateProxy",
    expectedArgs: [],
  },
  {
    name: "mode",
    method: "post",
    path: "/api/guilds/guild-1/proxy/mode",
    body: { mode: "auto" },
    service: "setProxyMode",
    expectedArgs: ["auto"],
  },
  {
    name: "source",
    method: "post",
    path: "/api/guilds/guild-1/proxy/source",
    body: { list_source_url: "https://proxy.example/list.txt" },
    service: "setProxyListSource",
    expectedArgs: ["https://proxy.example/list.txt"],
  },
];

describe("Dashboard proxy routes", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(cases)(
    "proxies $name and returns scraper result",
    async (testCase) => {
      const result = { success: true, data: { mode: "auto" } };
      scraperService[testCase.service].mockResolvedValue(result);

      let call = request(createApp())[testCase.method](testCase.path);
      if (testCase.body) call = call.send(testCase.body);
      const response = await call.expect(200);

      expect(response.body).toEqual(result);
      expect(scraperService[testCase.service]).toHaveBeenCalledWith(
        ...testCase.expectedArgs,
      );
    },
  );

  it.each(cases)(
    "returns 502 when $name cannot reach scraper",
    async (testCase) => {
      scraperService[testCase.service].mockRejectedValue(
        new Error("connect ECONNREFUSED 127.0.0.1:8100"),
      );

      let call = request(createApp())[testCase.method](testCase.path);
      if (testCase.body) call = call.send(testCase.body);
      const response = await call.expect(502);

      expect(response.body).toEqual({
        error: "Failed to reach scraper: connect ECONNREFUSED 127.0.0.1:8100",
      });
    },
  );

  it("rejects an invalid mode before calling scraper", async () => {
    const response = await request(createApp())
      .post("/api/guilds/guild-1/proxy/mode")
      .send({ mode: "sometimes" })
      .expect(400);

    expect(response.body.error).toBe("mode must be off, manual, or auto");
    expect(scraperService.setProxyMode).not.toHaveBeenCalled();
  });

  it.each(["", "ftp://proxy.example/list.txt", "not-a-url"])(
    "rejects invalid source URL %p before calling scraper",
    async (listSourceUrl) => {
      const response = await request(createApp())
        .post("/api/guilds/guild-1/proxy/source")
        .send({ list_source_url: listSourceUrl })
        .expect(400);

      expect(response.body.error).toBe(
        "list_source_url must be a valid HTTP or HTTPS URL",
      );
      expect(scraperService.setProxyListSource).not.toHaveBeenCalled();
    },
  );
});
