const { Events } = require("discord.js");
const Logger = require("../lib/logger");
const config = require("../config/config");

const logger = new Logger("DASHBOARD");

module.exports = (client) => {
  const { DASHBOARD_HOST: host, DASHBOARD_PORT: port } = config;

  client.once(Events.ClientReady, () => {
    try {
      const createDashboard = require("../dashboard/server");
      const app = createDashboard(client);

      app.listen(port, host, () => {
        logger.success(`Dashboard listening on http://${host}:${port}`);
      });
    } catch (error) {
      logger.error(`Failed to start dashboard: ${error.message}`);
      throw error;
    }
  });

  logger.info("Dashboard loader registered (starts on ClientReady)");
};
