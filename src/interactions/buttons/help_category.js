const HelpCommand = require("../../commands/slash/misc/Help");
const Logger = require("../../lib/logger");

const logger = new Logger("HELP");

module.exports = {
  customId: "help_category",
  execute: async (interaction, client) => {
    try {
      const customId = interaction.customId;

      const allCommands = HelpCommand.collectCommands();
      const sortedCategories = HelpCommand.getSortedCategories(allCommands);

      if (customId === "help_category:select") {
        const category = interaction.values[0];
        const commands = allCommands.get(category) || [];

        const embed = HelpCommand.buildCategoryEmbed(
          client,
          category,
          commands,
        );
        const components = HelpCommand.buildHelpComponents(
          sortedCategories,
          category,
        );

        await interaction.editReply({ embeds: [embed], components });
        return;
      }

      if (customId === "help_category:home") {
        const totalCommands = [...allCommands.values()].reduce(
          (acc, arr) => acc + arr.length,
          0,
        );

        const embed = HelpCommand.buildHomeEmbed(
          client,
          interaction.guild,
          totalCommands,
          allCommands.size,
        );
        const components = HelpCommand.buildHelpComponents(sortedCategories);

        await interaction.editReply({ embeds: [embed], components });
        return;
      }
    } catch (err) {
      logger.error(`Error in help_category handler: ${err.message}`);
    }
  },
};
