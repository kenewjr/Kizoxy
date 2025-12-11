const { PermissionsBitField, ChannelType } = require("discord.js");
const Logger = require("../../utils/logger");
const logger = new Logger("VOICE");

module.exports = async (client, oldState, newState) => {
  try {
    const player = client.manager.players.get(newState.guild.id);
    if (!player) return;

    if (!newState.guild.members.cache.get(client.user.id).voice.channelId) {
      logger.info(
        `Bot not in voice channel, destroying player for guild ${newState.guild.name}`,
      );
      player.destroy();
    }

    if (
      newState.channelId &&
      newState.channel.type == ChannelType.GuildStageVoice &&
      newState.guild.members.me.voice.suppress
    ) {
      if (
        newState.guild.members.me.permissions.has(
          PermissionsBitField.Flags.Speak,
        ) ||
        (newState.channel &&
          newState.channel
            .permissionsFor(newState.guild.members.me)
            .has(PermissionsBitField.Flags.Speak))
      ) {
        await delay(2000);

        newState.guild.members.me.voice.setSuppressed(false);
        logger.debug(
          `Stage speaker suppression removed in ${newState.guild.name}`,
        );
      }
    }

    if (oldState.id === client.user.id) return;
    if (!oldState.guild.members.cache.get(client.user.id).voice.channelId)
      return;

    if (player.data.get("stay")) {
      logger.debug(
        `Player set to stay in voice channel for guild ${newState.guild.name}`,
      );
      return;
    }

    if (
      oldState.guild.members.cache.get(client.user.id).voice.channelId ===
      oldState.channelId
    ) {
      if (
        oldState.guild.members.me.voice?.channel &&
        oldState.guild.members.me.voice.channel.members.filter(
          (m) => !m.user.bot,
        ).size === 0
      ) {
        logger.debug(
          `Voice channel empty, scheduling destroy for guild ${newState.guild.name}`,
        );

        await delay(client.config.LEAVE_EMPTY); // 2 minutes

        const vcMembers = oldState.guild.members.me.voice.channel?.members.size;
        if (!vcMembers || vcMembers === 1) {
          if (!player) return;
          logger.info(
            `Destroying player due to empty voice channel in guild ${newState.guild.name}`,
          );
          await player.destroy();
        }
      }
    }
  } catch (error) {
    logger.error(`Error in voiceStateUpdate: ${error.message}`);
  }
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
