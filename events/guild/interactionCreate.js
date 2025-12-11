const { InteractionType } = require("discord.js");
const ytsr = require("@distube/ytsr");
const { SEARCH_DEFAULT } = require("../../settings/config.js");
const Logger = require("../../utils/logger");
const logger = new Logger("INTERACTION");

module.exports = async (client, interaction) => {
  logger.info(`Interaction created: ${interaction.type}`);

  // ----- 1) Handle button interactions first -----
  if (interaction.isButton && interaction.isButton()) {
    logger.debug(
      `Button interaction: customId=${interaction.customId} by ${interaction.user?.tag || interaction.user?.id}`,
    );

    try {
      const buttonHandler = require("./buttonInteraction");
      await buttonHandler(client, interaction);
    } catch (err) {
      logger.error(`Error handling button interaction: ${err.message}`);
    }
    return;
  }

  // ----- 2) Autocomplete handling -----
  if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
    if (!interaction.guild || interaction.user.bot) return;

    const Random =
      SEARCH_DEFAULT[Math.floor(Math.random() * SEARCH_DEFAULT.length)];

    if (interaction.commandName === "play") {
      let choice = [];
      try {
        await ytsr(interaction.options.getString("search") || Random, {
          safeSearch: true,
          limit: 10,
        }).then((result) =>
          result.items.forEach((x) =>
            choice.push({ name: x.name, value: x.url }),
          ),
        );
        await interaction.respond(choice);
        logger.debug(`Autocomplete results sent for play command`);
      } catch (error) {
        logger.warning(
          `Autocomplete failed for play command: ${error.message}`,
        );
      }
      return;
    } else {
      try {
        const sub = interaction.options.getSubcommand();
        if (sub === "playskip" || sub === "playtop") {
          let choice = [];
          try {
            await ytsr(interaction.options.getString("search") || Random, {
              safeSearch: true,
              limit: 10,
            }).then((result) =>
              result.items.forEach((x) =>
                choice.push({ name: x.name, value: x.url }),
              ),
            );
            await interaction.respond(choice);
            logger.debug(`Autocomplete results sent for ${sub} command`);
          } catch (error) {
            logger.warning(
              `Autocomplete failed for ${sub} command: ${error.message}`,
            );
          }
          return;
        }
      } catch (e) {
        // No subcommand
      }
    }
  }

  // ----- 3) Command / ContextMenu / Modal handling -----
  if (
    (interaction.isCommand && interaction.isCommand()) ||
    (interaction.isContextMenuCommand && interaction.isContextMenuCommand()) ||
    (interaction.isModalSubmit && interaction.isModalSubmit()) ||
    (interaction.isChatInputCommand && interaction.isChatInputCommand())
  ) {
    if (!interaction.guild || interaction.user.bot) return;

    let subCommandName = "";
    try {
      subCommandName = interaction.options.getSubcommand();
    } catch {}

    let subCommandGroupName = "";
    try {
      subCommandGroupName = interaction.options.getSubcommandGroup();
    } catch {}

    const command = client.commands.find((command) => {
      switch (command.name.length) {
        case 1:
          return command.name[0] == interaction.commandName;
        case 2:
          return (
            command.name[0] == interaction.commandName &&
            command.name[1] == subCommandName
          );
        case 3:
          return (
            command.name[0] == interaction.commandName &&
            command.name[1] == subCommandGroupName &&
            command.name[2] == subCommandName
          );
        default:
          return false;
      }
    });

    if (!command) {
      logger.warning(`Command not found: ${interaction.commandName}`);
      return;
    }

    try {
      logger.info(
        `Executing command: ${command.name.join(" ")} by ${interaction.user.tag}`,
      );
      await command.run(client, interaction);
      logger.success(
        `Command executed successfully: ${command.name.join(" ")}`,
      );
    } catch (error) {
      logger.error(
        `Error executing command ${command.name.join(" ")}: ${error.message}`,
      );

      try {
        await interaction.reply({
          content: `❌ Something went wrong executing this command!`,
          ephemeral: true,
        });
      } catch (replyError) {
        logger.warning(`Failed to send error reply: ${replyError.message}`);
      }
    }
  }
};
