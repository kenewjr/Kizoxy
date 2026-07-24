const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fixembedStorage = require("../../persistence/fixembedStorage");
const Logger = require("../../lib/logger");
const { extractFixedLinks } = require("./fixembedResolver");

const logger = new Logger("FIXEMBED");

function formatLine(link) {
  let line = `[${link.originalLabel}](<${link.original}>)`;
  if (link.authorUrl && link.authorName) {
    line += ` • [@${link.authorName}](<${link.authorUrl}>)`;
  }
  line += ` • [${link.fixerName}](${link.fixed})`;
  if (link.spoiler) {
    line = `||${line} ||`;
  }
  return line;
}

function buildDeleteRow(authorId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`fixembed_delete:${authorId}`)
      .setLabel("🗑️ Delete")
      .setStyle(ButtonStyle.Danger),
  );
}

async function handleFixembedMessage(message) {
  if (message.content.toLowerCase().includes("fxignore")) return;

  const settings = fixembedStorage.getSettings(message.guild.id);

  // 1. Master toggle
  if (!settings.enabled) return;

  // 2. Ignored channel
  if (settings.ignoredChannels?.includes(message.channel.id)) return;

  // Ignored user/role to prevent regressions
  if (settings.ignoredUsers?.includes(message.author.id)) return;
  const memberRoles = message.member?.roles?.cache?.map((r) => r.id) ?? [];
  if (memberRoles.some((rid) => settings.ignoredRoles?.includes(rid))) return;

  if (fixembedStorage.hasIgnoredKeyword(message.guild.id, message.content)) {
    return;
  }

  const fixedLinks = await extractFixedLinks(message.content, settings);
  if (fixedLinks.length === 0) return;

  const changed = fixedLinks.filter((l) => l.changed);
  if (changed.length === 0) return;

  const replyContent = changed.map(formatLine).join("\n");
  const deleteRow = buildDeleteRow(message.author.id);

  try {
    if (settings.deleteBehavior === "delete") {
      try {
        await message.delete();
      } catch (_) {
        /* missing permissions — ignore */
      }
      await message.channel.send({
        content: `-# ${message.author} •\n${replyContent}`,
        allowedMentions: { users: [] },
        components: [deleteRow],
      });
    } else if (settings.deleteBehavior === "suppress") {
      try {
        await message.suppressEmbeds(true);
      } catch (_) {
        /* missing permissions — ignore */
      }
      await message.reply({
        content: replyContent,
        allowedMentions: { repliedUser: false },
        components: [deleteRow],
      });
    } else {
      // none
      await message.reply({
        content: replyContent,
        allowedMentions: { repliedUser: false },
        components: [deleteRow],
      });
    }
  } catch (err) {
    logger.error(`Failed to send fixed link reply: ${err.message}`);
  }
}

module.exports = {
  handleFixembedMessage,
};
