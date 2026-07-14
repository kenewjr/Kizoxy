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

async function applyBaseAction(message, action) {
  if (action === "delete_message") {
    try {
      await message.delete();
    } catch (_) {
      /* missing permissions — ignore */
    }
    return true;
  }
  if (action === "remove_embed") {
    try {
      await message.suppressEmbeds(true);
    } catch (_) {
      /* missing permissions — ignore */
    }
  }
  return false;
}

async function handleFixembedMessage(message) {
  if (message.content.toLowerCase().includes("fxignore")) return;

  if (
    !fixembedStorage.isEnabled(
      message.guild.id,
      message.channel.id,
      message.member,
    )
  ) {
    return;
  }

  if (fixembedStorage.hasIgnoredKeyword(message.guild.id, message.content)) {
    return;
  }

  const settings = fixembedStorage.getSettings(message.guild.id);
  const fixedLinks = await extractFixedLinks(
    message.content,
    settings.viewMode,
    settings.platforms,
  );
  if (fixedLinks.length === 0) return;

  const changed = fixedLinks.filter((l) => l.changed);
  const action = settings.baseMessageAction;

  if (action === "nothing" && changed.length === 0) return;

  const wasDeleted = await applyBaseAction(message, action);
  if (changed.length === 0) return;

  const replyContent = changed.map(formatLine).join("\n");
  const deleteRow = buildDeleteRow(message.author.id);

  try {
    if (wasDeleted) {
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
    logger.error(`Failed to send fixed link reply: ${err.message}`);
  }
}

module.exports = {
  handleFixembedMessage,
};
