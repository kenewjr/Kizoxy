const { InteractionType } = require("discord.js");
const { SEARCH_DEFAULT } = require("../../config/config");
const Logger = require("../../lib/logger");
const logger = new Logger("INTERACTION");

const CHOICE_LEN = 100;

function truncateChoice(str, max = CHOICE_LEN) {
  if (str == null || str === "") return "";
  const s = String(str);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

async function playSearchAutocompleteChoices(manager, query) {
  const q = (query || "").trim();
  if (!q) return [];
  const res = await manager.search(q, { requester: null }).catch(() => null);
  if (!res?.tracks?.length) return [];
  return res.tracks.slice(0, 25).map((t) => {
    const title = t.title || "Track";
    const value = t.uri || t.identifier || title;
    return {
      name: truncateChoice(title),
      value: truncateChoice(value),
    };
  });
}

module.exports = async (client, interaction) => {
  logger.debug(`Interaction created: ${interaction.type}`);

  const isAnySelectOrButton =
    interaction.isButton?.() ||
    interaction.isStringSelectMenu?.() ||
    interaction.isChannelSelectMenu?.() ||
    interaction.isUserSelectMenu?.() ||
    interaction.isRoleSelectMenu?.();

  if (isAnySelectOrButton) {
    logger.debug(
      `Button/Select interaction: customId=${interaction.customId} by ${interaction.user?.tag || interaction.user?.id}`,
    );

    try {
      const buttonHandler = require("./buttonInteraction");
      await buttonHandler(client, interaction);
    } catch (err) {
      logger.error(`Error handling button/select interaction: ${err.message}`);
    }
    return;
  }

  if (
    interaction.isModalSubmit?.() &&
    interaction.customId.startsWith("alarm_")
  ) {
    logger.debug(
      `Modal submit: customId=${interaction.customId} by ${interaction.user?.tag || interaction.user?.id}`,
    );
    try {
      const buttonHandler = require("./buttonInteraction");
      await buttonHandler(client, interaction);
    } catch (err) {
      logger.error(`Error handling modal submit: ${err.message}`);
    }
    return;
  }

  if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
    if (!interaction.guild || interaction.user.bot) return;

    const Random =
      SEARCH_DEFAULT[Math.floor(Math.random() * SEARCH_DEFAULT.length)];

    if (interaction.commandName === "play") {
      try {
        const raw = interaction.options.getString("search") || Random;
        let choice = await playSearchAutocompleteChoices(client.manager, raw);
        if (!choice.length) {
          choice = await playSearchAutocompleteChoices(client.manager, Random);
        }
        await interaction.respond(choice.length ? choice : []);
        logger.debug(`Autocomplete results sent for play command`);
      } catch (error) {
        logger.warning(
          `Autocomplete failed for play command: ${error.message}`,
        );
        try {
          await interaction.respond([]);
        } catch (__) {
          /* ignore */
        }
      }
      return;
    } else {
      try {
        const sub = interaction.options.getSubcommand();
        if (sub === "playskip" || sub === "playtop") {
          try {
            const raw = interaction.options.getString("search") || Random;
            let choice = await playSearchAutocompleteChoices(
              client.manager,
              raw,
            );
            if (!choice.length) {
              choice = await playSearchAutocompleteChoices(
                client.manager,
                Random,
              );
            }
            await interaction.respond(choice.length ? choice : []);
            logger.debug(`Autocomplete results sent for ${sub} command`);
          } catch (error) {
            logger.warning(
              `Autocomplete failed for ${sub} command: ${error.message}`,
            );
            try {
              await interaction.respond([]);
            } catch (__) {
              /* ignore */
            }
          }
          return;
        }
      } catch (_e) {
        // No subcommand
      }
    }
  }

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
      logger.debug(
        `Executing command: ${command.name.join(" ")} by ${interaction.user.tag}`,
      );
      await command.run(client, interaction);
      logger.debug(`Command executed successfully: ${command.name.join(" ")}`);
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
