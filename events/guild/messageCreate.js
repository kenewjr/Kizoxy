const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const LevelStorage = require("../../utils/levelStorage");
const fixembedStorage = require("../../utils/fixembedStorage");
const { extractFixedLinks } = require("../../utils/fixembedResolver");

// Map to store cooldowns: userId -> timestamp
const cooldowns = new Map();
const COOLDOWN_DURATION = 15000; // 15 seconds

module.exports = async (client, message) => {
  if (message.author.bot || !message.guild) return;

  // --- PREFIX COMMAND HANDLING ---
  const prefix = client.prefix;
  if (message.content.startsWith(prefix)) {
    const rawArgs = message.content.slice(prefix.length).trim().split(/ +/g);
    // Create a copy for command matching to avoid mutating original if needed (though shift essentially consumes command)
    const args = [...rawArgs];
    const cmd = args.shift().toLowerCase();

    if (cmd.length === 0) return;

    // Check prefix commands FIRST (since this IS a prefix command)
    let command = client.prefixCommands.get(cmd);

    if (!command) {
      command = client.commands.get(cmd);
      if (!command && client.aliases && client.aliases.has(cmd)) {
        command = client.commands.get(client.aliases.get(cmd));
      }
    }

    // If command logic exists
    if (command) {
      try {
        if (command.userPermissions) {
          if (!message.member.permissions.has(command.userPermissions)) {
            return message.reply(
              "❌ | You don't have enough permissions to use this command.",
            );
          }
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
            console.warn("Failed to delete level up message:", err),
          );
      }, 15000);
    }
  } catch (error) {
    console.error("Error adding text XP:", error);
  }

  // --- FIXEMBED: Social Media Embed Fixer ---
  // Skip if message contains fxignore
  if (message.content.toLowerCase().includes("fxignore")) return;

  // Skip if disabled for this guild/channel/member
  if (!fixembedStorage.isEnabled(message.guild.id, message.channel.id, message.member)) return;

  // Skip if message contains an ignored keyword
  if (fixembedStorage.hasIgnoredKeyword(message.guild.id, message.content)) return;

  // Get guild settings
  const fxSettings = fixembedStorage.getSettings(message.guild.id);

  // Extract fixed links (pass viewMode so subdomains are adjusted)
  const fixedLinks = await extractFixedLinks(message.content, fxSettings.viewMode);
  if (fixedLinks.length === 0) return;

  // Filter to only links that were actually changed
  const changed = fixedLinks.filter((l) => l.changed);

  // ── Apply base message action ──────────────────────────────────────────
  const action = fxSettings.baseMessageAction;

  if (action === 'nothing' && changed.length === 0) return;

  if (action === 'remove_embed' || action === 'delete_message') {
    try {
      if (action === 'delete_message') {
        await message.delete();
      } else {
        await message.suppressEmbeds(true);
      }
    } catch (_) {
      // Missing permissions — silently skip
    }
  }

  if (changed.length === 0) return;

  // ── Build FixTweetBot-style hypertext reply ────────────────────────────
  // Format: [Label](<orig>) • [@username](<profile>) • [Fixer](fixed)
  const lines = changed.map((l) => {
    let line = `[${l.originalLabel}](<${l.original}>)`;

    if (l.authorUrl && l.authorName) {
      line += ` • [@${l.authorName}](<${l.authorUrl}>)`;
    }

    line += ` • [${l.fixerName}](${l.fixed})`;

    // Wrap in spoiler if the original link was inside ||…||
    if (l.spoiler) {
      line = `||${line} ||`;
    }

    return line;
  });

  const replyContent = lines.join("\n");

  try {
    // Build delete button — only the original author can use it
    const deleteRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`fixembed_delete:${message.author.id}`)
        .setLabel("🗑️ Delete")
        .setStyle(ButtonStyle.Danger),
    );

    // When the original message was deleted we can no longer reply to it
    // (Discord returns MESSAGE_REFERENCE_UNKNOWN_MESSAGE) — use channel.send instead
    if (action === 'delete_message') {
      await message.channel.send({
        content: `-# ${message.author} •\n${replyContent}`,
        allowedMentions: { users: [] },
        components: [deleteRow],
      });
    } else {
      await message.reply({
        content: replyContent,
        allowedMentions: { repliedUser: false },
        components: [deleteRow],
      });
    }
  } catch (err) {
    console.error("[FixEmbed] Failed to send fixed link reply:", err);
  }
};

