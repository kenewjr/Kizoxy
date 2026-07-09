const router = require("express").Router();
const Logger = require("../../lib/logger");
const {
  listLogFiles,
  readLogFile,
  searchLogFile,
  getLogLevelCounts,
} = require("../helpers/logReader");

const logger = new Logger("DASHBOARD");

// GET /api/logs
router.get("/", (_req, res) => {
  try {
    res.json(listLogFiles());
  } catch (err) {
    logger.error(`GET /api/logs: ${err.message}`);
    res.status(500).json({ error: "Failed to list log files" });
  }
});

// GET /api/logs/:name
router.get("/:name", (req, res) => {
  try {
    const { name } = req.params;
    const { tail, search } = req.query;

    if (search) {
      const lines = searchLogFile(name, search);
      const levelCounts = getLogLevelCounts(name);
      return res.json({ lines, level_counts: levelCounts });
    }

    const content = readLogFile(name, tail ? parseInt(tail, 10) : undefined);
    const levelCounts = getLogLevelCounts(name);
    res.json({ content, level_counts: levelCounts });
  } catch (err) {
    if (err.code === "EINVAL")
      return res.status(400).json({ error: err.message });
    if (err.code === "ENOENT")
      return res.status(404).json({ error: "Log file not found" });
    logger.error(`GET /api/logs/${req.params.name}: ${err.message}`);
    res.status(500).json({ error: "Failed to read log file" });
  }
});

module.exports = router;
