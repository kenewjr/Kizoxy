const Logger = require("../../lib/logger");
const {
  handleFixembedMessage,
} = require("../../features/fixembed/fixembedMessageHandler");
const { handleMessageXp } = require("../../features/level/messageXpHandler");

const logger = new Logger("MESSAGE");

function resolvePrefixCommand(client, name) {
  let command = client.prefixCommands.get(name);
  if (command) return command;
  command = client.commands.get(name);
  if (command) return command;
  if (client.aliases?.has(name)) {
    return client.commands.get(client.aliases.get(name));
  }
  return null;
}

async function dispatchPrefixCommand(client, message, prefix) {
  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const cmd = (args.shift() || "").toLowerCase();
  if (!cmd) return false;

  const command = resolvePrefixCommand(client, cmd);
  if (!command) return false;

  try {
    if (
      command.userPermissions &&
      !message.member.permissions.has(command.userPermissions)
    ) {
      await message.reply(
        "❌ | You don't have enough permissions to use this command.",
      );
      return true;
    }
    if (command.run) {
      await command.run(client, message, args, prefix);
    } else if (command.exec) {
      await command.exec(client, message, args);
    }
  } catch (error) {
    logger.error(`Error executing prefix command ${cmd}: ${error.message}`);
    message
      .reply("There was an error trying to execute that command!")
      .catch(() => {});
  }
  return true;
}

module.exports = async (client, message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = client.prefix;
  if (prefix && message.content.startsWith(prefix)) {
    await dispatchPrefixCommand(client, message, prefix);
  }

  const results = await Promise.allSettled([
    handleMessageXp(client, message),
    handleFixembedMessage(message),
  ]);
  for (const [idx, result] of results.entries()) {
    if (result.status === "rejected") {
      const handler = idx === 0 ? "handleMessageXp" : "handleFixembedMessage";
      logger.error(
        `${handler} failed: ${result.reason?.message ?? result.reason}`,
      );
    }
  }
};
