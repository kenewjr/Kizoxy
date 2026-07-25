const { PermissionsBitField } = require("discord.js");
const {
  buildMainMenuEmbed,
  buildMainMenuComponents,
} = require("../../../features/tempvc/panelBuilders/mainMenuBuilder");
const { replyError } = require("../../../lib/interactions");
const Logger = require("../../../lib/logger");
const logger = new Logger("TEMP_VC_COMMAND");

module.exports = {
  name: ["tempvc"],
  description: "Configure TempVC generators, templates, and voice roles.",
  category: "Voice",
  permissions: {
    user: [PermissionsBitField.Flags.ManageGuild],
  },
  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: false });
    try {
      const embed = await buildMainMenuEmbed(client, interaction.guildId);
      const rows = await buildMainMenuComponents(client, interaction.guildId);
      await interaction.editReply({ embeds: [embed], components: rows });
    } catch (err) {
      logger.error(`Error in /tempvc run: ${err.message}`);
      await replyError(interaction, err, { ephemeral: false });
    }
  },
};
