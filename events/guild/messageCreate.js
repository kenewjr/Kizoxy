const { PREFIX } = require("../../settings/config.js");
const Logger = require("../../utils/logger");
const logger = new Logger("MESSAGE");

module.exports = async (client, message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/g);
  const cmdName = args.shift().toLowerCase();

  const command = client.prefixCommands.get(cmdName);
  if (!command) return;

  try {
    logger.info(
      `Executing prefix command: ${cmdName} by ${message.author.tag}`,
    );
    await command.run(client, message, args);
    logger.success(`Prefix command executed successfully: ${cmdName}`);
  } catch (err) {
    logger.error(`Error executing prefix command ${cmdName}: ${err.message}`);
    message.reply("❌ Error executing command.").catch(() => {
      logger.warning(`Failed to send error reply for command: ${cmdName}`);
    });
  }
};
