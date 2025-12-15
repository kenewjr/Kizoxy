const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const LevelStorage = require("../../utils/levelStorage");

// Map to store cooldowns: userId -> timestamp
const cooldowns = new Map();
const COOLDOWN_DURATION = 15000; // 15 seconds

module.exports = async (client, message) => {
  if (message.author.bot || !message.guild) return;

  // --- PREFIX COMMAND HANDLING ---
  const prefix = client.prefix;
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const cmd = args.shift().toLowerCase();

    if (cmd.length === 0) return;

    let command = client.commands.get(cmd);
    if (!command) command = client.commands.get(client.aliases.get(cmd));
    
    // Also check prefix commands map if they are stored separately
    if (!command && client.prefixCommands) {
        command = client.prefixCommands.get(cmd);
    }
    
    // If command logic exists
    if (command) {
        try {
            // Check permissions if needed (simple check)
            if (command.userPermissions) {
               // ...
            }
            // Execute command
            if (command.run) {
                command.run(client, message, args, prefix);
            } else if (command.exec) {
                // Some frameworks use exec
                 command.exec(client, message, args);
            }
        } catch (error) {
            console.error(`Error executing prefix command ${cmd}:`, error);
            message.reply("There was an error trying to execute that command!");
        }
        // Return here if you don't want XP for commands, 
        // OR continue if you want XP even for running commands. 
        // Usually commands give XP too, so we won't return.
    }
  }

  // --- LEVELING SYSTEM ---
  // Initialize storage if not already done
  if (!client.levelStorage) {
    client.levelStorage = new LevelStorage();
  }

  // Check cooldown
  const now = Date.now();
  if (cooldowns.has(message.author.id)) {
    const expirationTime = cooldowns.get(message.author.id) + COOLDOWN_DURATION;
    if (now < expirationTime) {
      return; // On cooldown
    }
  }

  // Set cooldown
  cooldowns.set(message.author.id, now);
  setTimeout(() => cooldowns.delete(message.author.id), COOLDOWN_DURATION);

  // Add random XP between 10 and 20
  const xpToAdd = Math.floor(Math.random() * 11) + 10;

  try {
    const result = await client.levelStorage.addXp(
      message.author.id,
      message.guild.id,
      xpToAdd,
    );

    if (result.leveledUp) {
      const embed = new EmbedBuilder()
        .setColor(client.color)
        .setDescription(
          `🎉 **Congratulations ${message.author}!** You have leveled up to **Level ${result.level}**!`,
        );

      const msg = await message.channel.send({ embeds: [embed] });

      // Auto-delete after 15 seconds
      setTimeout(() => {
        msg
          .delete()
          .catch((err) =>
            console.log("Failed to delete level up message:", err),
          );
      }, 15000);
    }
  } catch (error) {
    console.error("Error adding text XP:", error);
  }
};
