const Embeds = require("../../lib/embeds");
const { COLORS } = Embeds;
const LevelStorage = require("../../persistence/levelStorage");

const XP_PER_MINUTE = 10;
const MIN_DURATION = 60000; // 1 minute

module.exports = async (client, oldState, newState) => {
  if (newState.member.user.bot) return;

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
          try {
            await client.levelStorage.addXp(
              oldState.member.id,
              oldState.guild.id,
              xpToAdd,
            );
          } catch (error) {
            console.error("Error adding voice XP:", error);
          }
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
    console.error(`Could not send voiceStateUpdate log:`, err);
  }
};
