const { readdirSync } = require("fs");
const path = require("path");
const Logger = require("../utils/logger");
const logger = new Logger("COMMAND");

module.exports = (client) => {
  try {
    const commandsDir = path.join(__dirname, "..", "commands", "Slash");
    const categories = readdirSync(commandsDir);
    let totalLoaded = 0;
    let failedLoads = [];

    for (const category of categories) {
      const categoryPath = path.join(commandsDir, category);
      const commandFiles = readdirSync(categoryPath).filter((file) =>
        file.endsWith(".js"),
      );

      logger.info(
        `Loading ${commandFiles.length} commands from ${category}...`,
      );

      for (const file of commandFiles) {
        try {
          const filePath = path.join(categoryPath, file);
          const command = require(filePath);

          if (!command.name || !command.run) {
            throw new Error("Invalid command structure");
          }

          const commandName = Array.isArray(command.name)
            ? command.name.join(" ")
            : command.name;
          client.commands.set(commandName, command);
          logger.success(`Loaded: ${commandName}`);
          totalLoaded++;
        } catch (error) {
          logger.error(`Failed to load ${file}: ${error.message}`);
          failedLoads.push({ file, error: error.message });
        }
      }
    }

    logger.info(`Total commands loaded: ${totalLoaded}`);

    if (failedLoads.length > 0) {
      logger.warning(`${failedLoads.length} commands failed to load:`);
      failedLoads.forEach(({ file, error }) => {
        logger.warning(`- ${file}: ${error}`);
      });
    }
  } catch (error) {
    logger.error(`Error loading commands: ${error.message}`);
  }
};
