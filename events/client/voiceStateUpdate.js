const LevelStorage = require("../../utils/levelStorage");

// Constants
const XP_PER_MINUTE = 10;
const MIN_DURATION = 60000; // 1 minute

module.exports = async (client, oldState, newState) => {
  // Ignore bots
  if (newState.member.user.bot) return;

  // Initialize storage if not already done
  if (!client.levelStorage) {
    client.levelStorage = new LevelStorage();
  }

  // Initialize voice session map if needed
  if (!client.voiceSessions) {
    client.voiceSessions = new Map();
  }

  // User joined a voice channel
  if (!oldState.channelId && newState.channelId) {
    client.voiceSessions.set(newState.member.id, Date.now());
  }

  if (oldState.channelId && !newState.channelId) {
    const joinTime = client.voiceSessions.get(oldState.member.id);

    if (joinTime) {
      const duration = Date.now() - joinTime;
      client.voiceSessions.delete(oldState.member.id);

      if (duration >= MIN_DURATION) {
        // Calculate minutes
        const minutes = Math.floor(duration / 60000);
        const xpToAdd = minutes * XP_PER_MINUTE;

        if (xpToAdd > 0) {
          try {
            await client.levelStorage.addXp(
              oldState.member.id,
              oldState.guild.id,
              xpToAdd,
            );
            // Log removed to keep console clean as per user request
          } catch (error) {
            console.error("Error adding voice XP:", error);
          }
        }
      }
    }
  }
};
