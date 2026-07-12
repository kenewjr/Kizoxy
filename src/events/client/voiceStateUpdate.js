const Embeds = require("../../lib/embeds");
const { COLORS } = Embeds;
const LevelStorage = require("../../persistence/levelStorage");
const Logger = require("../../lib/logger");

const logger = new Logger("VOICE_STATE");

const XP_PER_MINUTE = 10;
const MIN_DURATION = 60000; // 1 minute
const xpDebounce = new Map(); // memberId -> timeoutId
const XP_DEBOUNCE_MS = 500;

module.exports = async (client, oldState, newState) => {
  if (newState.member?.user?.bot) return;

  if (!client.levelStorage) {
    client.levelStorage = new LevelStorage();
  }

  if (!client.voiceSessions) {
    client.voiceSessions = new Map();
  }

  if (!oldState.channelId && newState.channelId) {
    client.voiceSessions.set(newState.member.id, Date.now());
  }

  if (oldState.channelId && !newState.channelId) {
    const joinTime = client.voiceSessions.get(oldState.member.id);

    if (joinTime) {
      const duration = Date.now() - joinTime;
      client.voiceSessions.delete(oldState.member.id);

      if (duration >= MIN_DURATION) {
        const minutes = Math.floor(duration / 60000);
        const xpToAdd = minutes * XP_PER_MINUTE;

        if (xpToAdd > 0) {
          const memberId = oldState.member.id;
          const guildId = oldState.guild.id;
          if (xpDebounce.has(memberId)) {
            clearTimeout(xpDebounce.get(memberId));
          }
          xpDebounce.set(
            memberId,
            setTimeout(async () => {
              xpDebounce.delete(memberId);
              try {
                await client.levelStorage.addXp(memberId, guildId, xpToAdd);
              } catch (error) {
                logger.error(`Error adding voice XP: ${error.message}`);
              }
            }, XP_DEBOUNCE_MS),
          );
        }
      }
    }
  }

  if (!client.logStorage) return;
  const logChannelId = client.logStorage.getChannel(newState.guild.id);
  if (!logChannelId) return;

  const logChannel = newState.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  let title = null;
  let description = null;
  let color = null;

  if (!oldState.channelId && newState.channelId) {
    title = "Joined Voice Channel";
    description = `${newState.member} joined ${newState.channel}`;
    color = COLORS.SUCCESS;
  } else if (oldState.channelId && !newState.channelId) {
    title = "Left Voice Channel";
    description = `${oldState.member} left ${oldState.channel}`;
    color = COLORS.ERROR;
  } else if (
    oldState.channelId &&
    newState.channelId &&
    oldState.channelId !== newState.channelId
  ) {
    title = "Moved Voice Channel";
    description = `${newState.member} moved from ${oldState.channel} to ${newState.channel}`;
    color = COLORS.INFO;
  }

  if (!title) return;

  const embed = Embeds.withColor(client, color, {
    author: {
      name: newState.member.user.tag,
      iconURL: newState.member.user.displayAvatarURL({ dynamic: true }),
    },
    title,
    description,
    footerText: `User ID: ${newState.member.id}`,
  });

  try {
    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error(`Could not send voiceStateUpdate log: ${err.message}`);
  }
};
