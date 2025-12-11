const fs = require("fs");
const path = require("path");
const Logger = require("../utils/logger");
const logger = new Logger("PREFIX");

module.exports = (client) => {
  const basePath = path.join(__dirname, "../commands/prefix");
  let totalLoaded = 0;
  let failedLoads = [];

  try {
    fs.readdirSync(basePath).forEach((dir) => {
      const commandFiles = fs
        .readdirSync(`${basePath}/${dir}`)
        .filter((file) => file.endsWith(".js"));

      logger.info(`Loading ${commandFiles.length} commands from ${dir}...`);

      for (const file of commandFiles) {
        try {
          const command = require(`${basePath}/${dir}/${file}`);
          if (!command.name) {
            throw new Error("Command has no name");
          }

          client.prefixCommands.set(command.name, command);
          logger.success(`Loaded: ${command.name}`);
          totalLoaded++;

          if (command.aliases && Array.isArray(command.aliases)) {
            command.aliases.forEach((alias) => {
              client.prefixCommands.set(alias, command);
              logger.info(`Alias registered: ${alias} -> ${command.name}`);
            });
          }
        } catch (error) {
          logger.error(`Failed to load ${file}: ${error.message}`);
          failedLoads.push({ file, error: error.message });
        }
      }
    });

    logger.info(`Total prefix commands loaded: ${totalLoaded}`);

    if (failedLoads.length > 0) {
      logger.warning(`${failedLoads.length} prefix commands failed to load:`);
      failedLoads.forEach(({ file, error }) => {
        logger.warning(`- ${file}: ${error}`);
      });
    }
  } catch (error) {
    logger.error(`Error loading prefix commands: ${error.message}`);
  }
};
