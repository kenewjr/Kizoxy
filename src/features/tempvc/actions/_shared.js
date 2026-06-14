const Embeds = require("../../../lib/embeds");
const interfaceService = require("../interfaceService");
const Logger = require("../../../lib/logger");

const logger = new Logger("VC:Action");

function ok(client, title, description, fields) {
  return Embeds.success(client, { title, description, fields });
}

function bad(client, title, description) {
  return Embeds.error(client, { title, description });
}

async function refreshPanel(guild, channelId) {
  await interfaceService
    .updateInterface(guild, channelId)
    .catch((err) => logger.warning(`panel refresh failed: ${err.message}`));
}

module.exports = { ok, bad, refreshPanel, logger };
