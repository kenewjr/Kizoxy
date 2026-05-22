const Embeds = require("../../../lib/embeds");

function ensureManageGuild(interaction) {
  if (!interaction.memberPermissions?.has?.("ManageGuild")) {
    return "You need the **Manage Server** permission to run this command.";
  }
  return null;
}

function infoEmbed(client, opts) {
  return Embeds.info(client, opts);
}

function successEmbed(client, opts) {
  return Embeds.success(client, opts);
}

function errorEmbed(client, opts) {
  return Embeds.error(client, opts);
}

function warningEmbed(client, opts) {
  return Embeds.warning(client, opts);
}

async function replyEphemeralEmbed(interaction, embed) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ embeds: [embed], components: [] });
  }
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

function formatLimit(value) {
  return !value || value === 0 ? "Unlimited" : String(value);
}

function formatBitrate(bps) {
  if (!Number.isFinite(bps)) return "—";
  return `${Math.round(bps / 1000)} kbps`;
}

function formatChannel(channel) {
  if (!channel) return "—";
  return `<#${channel.id || channel}>`;
}

function formatRole(role) {
  if (!role) return "—";
  return `<@&${role.id || role}>`;
}

module.exports = {
  ensureManageGuild,
  infoEmbed,
  successEmbed,
  errorEmbed,
  warningEmbed,
  replyEphemeralEmbed,
  formatLimit,
  formatBitrate,
  formatChannel,
  formatRole,
};
