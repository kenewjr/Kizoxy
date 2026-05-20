const Embeds = require("../utils/embeds");
const { disableComponents } = require("../utils/interactions");
const Logger = require("../utils/logger");
const {
  validateMusicContext,
  scheduleAutoDelete,
} = require("../utils/helpers/musicHelper");

const logger = new Logger("MUSIC-STOP");

module.exports = {
  customId: "music-stop",
  execute: async (interaction, client) => {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }

      const ctx = validateMusicContext(client, interaction);
      if (ctx.error) {
        await interaction.editReply({
          embeds: [Embeds.error(client, { description: ctx.error })],
        });
        return scheduleAutoDelete(interaction);
      }

      const { player } = ctx;
      const channelName = interaction.guild.members.me?.voice?.channel?.name ?? "voice channel";

      // Disable now-playing buttons before destroying player
      try {
        const disabled = disableComponents(interaction.message.components);
        await interaction.message.edit({ components: disabled });
      } catch (err) {
        logger.error(`Failed to disable now-playing buttons: ${err.message}`);
      }

      await player.destroy();

      const embed = Embeds.success(client, {
        title: "Playback stopped",
        description: `Bot left **${channelName}**.`,
      });
      await interaction.editReply({ embeds: [embed] });

      scheduleAutoDelete(interaction);
    } catch (error) {
      logger.error(`Stop Button Error: ${error.message}`);
      try {
        await interaction.editReply({
          embeds: [
            Embeds.error(client, {
              description: "Failed to stop playback. Please try again shortly.",
            }),
          ],
        });
      } catch (_) {}
    }
  },
};
