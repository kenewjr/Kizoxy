const {
  errEmbed,
  loadContext,
  loadChannelRecord,
  safeReplyEphemeral,
  logger,
} = require("./_shared");
const Embeds = require("../../../lib/embeds");

const fileMap = {
  lock: require("./actions/lock"),
  unlock: require("./actions/unlock"),
  hide: require("./actions/hide"),
  show: require("./actions/unhide"),
  reset: require("./actions/reset"),
  muteall: require("./actions/muteall"),
  unbanall: require("./actions/unbanall"),
  pininfo: require("./actions/pininfo"),
  claim: require("./actions/claim"),

  rename: require("./actions/rename"),
  limit: require("./actions/limit"),
  allow: require("./actions/allow"),
  ban: require("./actions/ban"),
  kick: require("./actions/kick"),
  transfer: require("./actions/transfer"),
};

function parseCustomId(customId) {
  const parts = customId.split(":");
  if (parts[0] !== "tvc") return null;
  return { action: parts[1], channelId: parts[2] };
}

async function execute(interaction) {
  try {
    const parsed = parseCustomId(interaction.customId);
    if (!parsed) return;
    const { action, channelId } = parsed;
    if (!channelId) return;

    if (interaction.isButton?.()) {
      if (action === "rename") {
        const ctx = await loadContext(interaction, channelId);
        if (!ctx) return;
        return fileMap.rename.showModal(interaction, channelId);
      }
      if (action === "limit") {
        const ctx = await loadContext(interaction, channelId);
        if (!ctx) return;
        return fileMap.limit.showModal(interaction, channelId);
      }
      if (action === "allow") {
        const ctx = await loadContext(interaction, channelId);
        if (!ctx) return;
        return fileMap.allow.showModal(interaction, channelId);
      }
      if (action === "ban") {
        const ctx = await loadContext(interaction, channelId);
        if (!ctx) return;
        return fileMap.ban.showModal(interaction, channelId);
      }
      if (action === "kick" || action === "transfer") {
        const ctx = await loadContext(interaction, channelId);
        if (!ctx) return;
        return fileMap[action].showSelect(interaction, ctx);
      }
      if (action === "claim") {
        const ctx = await loadChannelRecord(interaction, channelId);
        if (!ctx) return;
        return fileMap.claim(interaction, interaction.client, channelId, ctx);
      }
      if (action === "pininfo") {
        const ctx = await loadContext(interaction, channelId);
        if (!ctx) return;
        return fileMap.pininfo(interaction, interaction.client, channelId, ctx);
      }

      // Simple toggles
      const ctx = await loadContext(interaction, channelId);
      if (!ctx) return;
      const handler = fileMap[action];
      if (handler) {
        return handler(interaction, interaction.client, channelId, ctx);
      }
      return;
    }

    if (interaction.isModalSubmit?.()) {
      const ctx = await loadContext(interaction, channelId);
      if (!ctx) return;
      if (action === "rename-modal")
        return fileMap.rename.handleModal(interaction, ctx);
      if (action === "limit-modal")
        return fileMap.limit.handleModal(interaction, ctx);
      if (action === "allow-modal")
        return fileMap.allow.handleModal(interaction, ctx);
      if (action === "ban-modal")
        return fileMap.ban.handleModal(interaction, ctx);
      return;
    }

    if (interaction.isStringSelectMenu?.()) {
      const ctx = await loadContext(interaction, channelId);
      if (!ctx) return;
      if (action === "kick-select")
        return fileMap.kick.handleSelect(interaction, ctx);
      if (action === "transfer-select")
        return fileMap.transfer.handleSelect(interaction, ctx);
      return;
    }
  } catch (err) {
    logger.error(
      `tvc handler failed (${interaction.customId}): ${err.message}`,
    );
    await safeReplyEphemeral(interaction, {
      embeds: [errEmbed(interaction.client, Embeds.formatError(err))],
    });
  }
}

module.exports = {
  name: "tvc",
  execute,
};
