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
  
  // User left a voice channel (or switched, but we treat switch as continuous if handled carefully, or just session break)
  // Simple approach: When leaving a channel (or switching), calculate duration.
  // If switching, add XP for previous session and start new one? 
  // Let's handle "left channel" condition.
  
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
            await client.levelStorage.addXp(oldState.member.id, oldState.guild.id, xpToAdd);
            console.log(`Added ${xpToAdd} voice XP to ${oldState.member.user.tag} for ${minutes} minutes`);
          } catch (error) {
            console.error("Error adding voice XP:", error);
          }
        }
      }
    }
  }
};
