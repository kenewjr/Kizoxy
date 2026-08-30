const router = require("express").Router();
const scraperService = require("../../integrations/scraperService/client");

// Proxy state belongs to kizoxy-scraper, not to req.params.id. Guild-shaped
// paths only keep dashboard routing consistent with other TikTok controls.
function scraperFailure(res, err) {
  return res
    .status(502)
    .json({ error: `Failed to reach scraper: ${err.message}` });
}

router.get("/:id/proxy/status", async (_req, res) => {
  try {
    res.json(await scraperService.getProxyStatus());
  } catch (err) {
    scraperFailure(res, err);
  }
});

router.post("/:id/proxy/rotate", async (_req, res) => {
  try {
    res.json(await scraperService.rotateProxy());
  } catch (err) {
    scraperFailure(res, err);
  }
});

router.post("/:id/proxy/mode", async (req, res) => {
  const { mode } = req.body;
  if (!["off", "manual", "auto"].includes(mode)) {
    return res.status(400).json({ error: "mode must be off, manual, or auto" });
  }

  try {
    return res.json(await scraperService.setProxyMode(mode));
  } catch (err) {
    return scraperFailure(res, err);
  }
});

router.post("/:id/proxy/source", async (req, res) => {
  const { list_source_url: listSourceUrl } = req.body;
  try {
    const url = new URL(listSourceUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
  } catch {
    return res.status(400).json({
      error: "list_source_url must be a valid HTTP or HTTPS URL",
    });
  }

  try {
    return res.json(await scraperService.setProxyListSource(listSourceUrl));
  } catch (err) {
    return scraperFailure(res, err);
  }
});

module.exports = router;
