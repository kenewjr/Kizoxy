const Embeds = require("../../../lib/embeds");

const MEMBER_LIST_LIMIT = 20;

module.exports = {
  run: async (client, interaction, ctx) => {
    const channel = ctx.channel;
    const tempRecord = ctx.tempRecord;
    const status = tempRecord.isHidden
      ? "👁 Hidden"
      : tempRecord.isLocked
        ? "🔒 Locked"
        : "🔓 Open";
    const memberList =
      channel.members
        .map((m) => `${m}`)
        .slice(0, MEMBER_LIST_LIMIT)
        .join(", ") || "—";
    return interaction.editReply({
      embeds: [
        Embeds.info(client, {
          title: tempRecord.name || channel.name,
          fields: [
            { name: "Owner", value: `<@${tempRecord.ownerId}>`, inline: true },
            { name: "Status", value: status, inline: true },
            {
              name: "Limit",
              value: tempRecord.limit ? String(tempRecord.limit) : "Unlimited",
              inline: true,
            },
            { name: "Members", value: `${channel.members.size}`, inline: true },
            {
              name: "Allowed",
              value: (tempRecord.allowedUsers || []).length
                ? tempRecord.allowedUsers.map((id) => `<@${id}>`).join(", ")
                : "—",
              inline: false,
            },
            {
              name: "Banned",
              value: (tempRecord.bannedUsers || []).length
                ? tempRecord.bannedUsers.map((id) => `<@${id}>`).join(", ")
                : "—",
              inline: false,
            },
            { name: "Currently in channel", value: memberList, inline: false },
          ],
          footerText: "Temporary Voice Channel",
        }),
      ],
    });
  },
};
