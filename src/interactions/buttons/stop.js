const Embeds = require("../../lib/embeds");
const { disableComponents, replyError } = require("../../lib/interactions");
const Logger = require("../../lib/logger");
const {
  validateMusicContext,
  scheduleAutoDelete,
} = require("../../features/music/musicHelper");

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
        await replyError(interaction, ctx.error, {
          title: null,
          ephemeral: false,
        });
        return scheduleAutoDelete(interaction);
      }

      const { player } = ctx;
      const channelName =
        interaction.guild.members.me?.voice?.channel?.name ?? "voice channel";

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
        await replyError(
          interaction,
          "Failed to stop playback. Please try again shortly.",
          { title: null, ephemeral: false },
        );
      } catch (_) {}
    }
  },
};
