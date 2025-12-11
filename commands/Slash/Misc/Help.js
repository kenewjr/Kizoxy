const { EmbedBuilder } = require("discord.js");
const { readdirSync } = require("fs");
const path = require("path");
const Logger = require("../../../utils/logger");

const logger = new Logger("HELP");

module.exports = {
  name: ["help"],
  description: "Display all commands the bot has.",
  category: "Misc",
  run: async (client, interaction) => {
    try {
      // Get all command categories from all command types
      const commandTypes = ["Slash", "Prefix", "Shared"];
      const allCommands = new Map();

      // Collect commands from all types
      for (const type of commandTypes) {
        const typePath = path.join("./commands", type);

        try {
          const categories = readdirSync(typePath);

          for (const category of categories) {
            const categoryPath = path.join(typePath, category);
            const commandFiles = readdirSync(categoryPath).filter((file) =>
              file.endsWith(".js"),
            );

            if (!allCommands.has(category)) {
              allCommands.set(category, []);
            }

            for (const file of commandFiles) {
              try {
                const command = require(
                  path.join("..", "..", "..", categoryPath, file),
                );
                if (command.name && command.description) {
                  allCommands.get(category).push({
                    name: Array.isArray(command.name)
                      ? command.name.join(" ")
                      : command.name,
                    description: command.description,
                    type: type,
                  });
                }
              } catch (error) {
                logger.error(`Error loading command ${file}: ${error.message}`);
              }
            }
          }
        } catch (error) {
          // Directory might not exist, skip it
          continue;
        }
      }

      // Create the embed
      const embed = new EmbedBuilder()
        .setColor(client.color)
        .setAuthor({
          name: `${interaction.guild.members.me.displayName} Help Command!`,
          iconURL: interaction.guild.iconURL({ dynamic: true }),
        })
        .setThumbnail(
          client.user.displayAvatarURL({ dynamic: true, size: 2048 }),
        )
        .setDescription(
          `The bot supports both slash commands (/) and prefix commands (${client.prefix})`,
        )
        .setFooter({
          text: `© ${interaction.guild.members.me.displayName} | Total Command Categories: ${allCommands.size}`,
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        });

      // Add fields for each category
      const sortedCategories = [...allCommands.keys()].sort();

      for (const category of sortedCategories) {
        const commands = allCommands.get(category);
        if (commands.length === 0) continue;

        const capitalise = category.charAt(0).toUpperCase() + category.slice(1);

        // Group commands by type for better organization
        const slashCommands = commands
          .filter((c) => c.type === "Slash")
          .map((c) => `\`/${c.name}\``);
        const prefixCommands = commands
          .filter((c) => c.type === "Prefix")
          .map((c) => `\`${client.prefix}${c.name}\``);
        const sharedCommands = commands
          .filter((c) => c.type === "Shared")
          .map((c) => `\`/${c.name}\` / \`${client.prefix}${c.name}\``);

        let value = "";

        if (slashCommands.length > 0) {
          value += `**Slash Commands:** ${slashCommands.join(", ")}\n`;
        }

        if (prefixCommands.length > 0) {
          value += `**Prefix Commands:** ${prefixCommands.join(", ")}\n`;
        }

        if (sharedCommands.length > 0) {
          value += `**Both Slash & Prefix:** ${sharedCommands.join(", ")}\n`;
        }

        if (value) {
          embed.addFields({
            name: `❯ ${capitalise} [${commands.length}]:`,
            value: value,
            inline: false,
          });
        }
      }

      logger.success(`Help command executed by ${interaction.user.tag}`);
      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error(`Error in help command: ${error.message}`);
      return interaction.reply({
        content: "❌ An error occurred while processing the help command.",
        ephemeral: true,
      });
    }
  },
};
