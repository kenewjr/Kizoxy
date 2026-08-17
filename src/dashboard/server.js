const express = require("express");
const path = require("path");
const Logger = require("../lib/logger");

const logger = new Logger("DASHBOARD");

function createDashboard(client) {
  const app = express();
  app.use(express.json({ limit: "15mb" }));
  app.locals.client = client;
  // no-cache: dashboard assets change frequently; avoid serving a stale
  // pages.js/app.js from the browser cache.
  app.use(
    express.static(path.join(__dirname, "public"), {
      etag: false,
      lastModified: false,
      setHeaders: (res) =>
        res.setHeader("Cache-Control", "no-store, must-revalidate"),
    }),
  );

  app.use("/api", require("./routes/meta"));
  app.use("/api/config", require("./routes/config"));
  app.use("/api/guilds", require("./routes/guilds"));
  app.use("/api/guilds", require("./routes/guildFixembed"));
  app.use("/api/guilds", require("./routes/guildLevel"));
  app.use("/api/guilds", require("./routes/guildTempvc"));
  app.use("/api/guilds", require("./routes/guildAlarms"));
  app.use("/api/guilds", require("./routes/youtube"));
  app.use("/api/guilds", require("./routes/tiktok"));
  app.use("/api/logs", require("./routes/logs"));
  app.use("/api/commands", require("./routes/commands"));
  app.use("/api/sendmsg", require("./routes/sendmsg"));

  // SPA catch-all: any GET not matched by /api/* returns index.html.
  // Express v5 requires named wildcard params.
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(__dirname, "public", "index.html")),
  );

  // Error handler middleware.
  app.use((err, _req, res, _next) => {
    logger.error(`Unhandled: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

module.exports = createDashboard;
