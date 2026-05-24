const { ApplicationCommandOptionType, ChannelType } = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const tempVcService = require("../../../features/tempvc/tempVcService");
const interfaceService = require("../../../features/tempvc/interfaceService");
const helper = require("../../../features/tempvc/tempVcHelper");
const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");
const logger = new Logger("VC:Control");

function ok(client, title, description, fields) {
  return Embeds.success(client, { title, description, fields });
}
function bad(client, title, description) {
  return Embeds.error(client, { title, description });
}

async function refreshPanel(guild, channelId) {
  await interfaceService
    .updateInterface(guild, channelId)
    .catch((err) => logger.warning(`panel refresh failed: ${err.message}`));
}

async function handleRename(client, interaction, ctx) {
  const raw = interaction.options.getString("name", true);
  const cleaned = tempVcService.renderChannelName(raw, interaction.member, 0);
  if (!cleaned || cleaned.length === 0) {
    return interaction.editReply({
      embeds: [
        bad(client, "Invalid name", "Name cannot be empty after sanitisation."),
      ],
    });
  }
  await ctx.channel.setName(cleaned, `TempVC rename by ${interaction.user.id}`);
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    name: cleaned,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [ok(client, "Renamed", `Channel is now **${cleaned}**.`)],
  });
}

async function handleLimit(client, interaction, ctx) {
  const limit = interaction.options.getInteger("number", true);
  await ctx.channel.setUserLimit(
    limit,
    `TempVC limit by ${interaction.user.id}`,
  );
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    limit,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [
      ok(
        client,
        "Limit updated",
        limit === 0
          ? "Channel is now unlimited."
          : `User limit set to **${limit}**.`,
      ),
    ],
  });
}

async function handleLock(client, interaction, ctx, locked) {
  await helper.applyLockState(interaction.guild, ctx.channel, locked);
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    isLocked: locked,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [
      ok(
        client,
        locked ? "Locked" : "Unlocked",
        locked ? "Only allowed users can join." : "Anyone can join.",
      ),
    ],
  });
}

async function handleHide(client, interaction, ctx, hidden) {
  await helper.applyHideState(interaction.guild, ctx.channel, hidden);
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    isHidden: hidden,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [
      ok(
        client,
        hidden ? "Hidden" : "Visible",
        hidden
          ? "Channel hidden from non-members."
          : "Channel visible to everyone.",
      ),
    ],
  });
}

async function handleAllow(client, interaction, ctx) {
  const user = interaction.options.getUser("user", true);
  await helper.applyAllowUser(ctx.channel, user.id);
  const allowed = Array.from(
    new Set([...(ctx.tempRecord.allowedUsers || []), user.id]),
  );
  const banned = (ctx.tempRecord.bannedUsers || []).filter(
    (id) => id !== user.id,
  );
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    allowedUsers: allowed,
    bannedUsers: banned,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [
      ok(client, "Access granted", `${user} can now join even when locked.`),
    ],
  });
}

async function handleKick(client, interaction, ctx) {
  const user = interaction.options.getUser("user", true);
  if (user.id === interaction.user.id) {
    return interaction.editReply({
      embeds: [bad(client, "Cannot kick", "You can't kick yourself.")],
    });
  }
  const member = interaction.guild.members.cache.get(user.id);
  if (!member || member.voice?.channelId !== ctx.channel.id) {
    return interaction.editReply({
      embeds: [
        bad(
          client,
          "Not in channel",
          `${user} is not connected to this channel.`,
        ),
      ],
    });
  }
  await member.voice
    .disconnect(`TempVC kick by ${interaction.user.id}`)
    .catch(() => {});
  return interaction.editReply({
    embeds: [
      ok(
        client,
        "Kicked",
        `${user} was disconnected. They can rejoin unless banned.`,
      ),
    ],
  });
}

async function handleBan(client, interaction, ctx) {
  const user = interaction.options.getUser("user", true);
  if (user.id === interaction.user.id) {
    return interaction.editReply({
      embeds: [bad(client, "Cannot ban", "You can't ban yourself.")],
    });
  }
  await helper.applyBanUser(interaction.guild, ctx.channel, user.id);
  const banned = Array.from(
    new Set([...(ctx.tempRecord.bannedUsers || []), user.id]),
  );
  const allowed = (ctx.tempRecord.allowedUsers || []).filter(
    (id) => id !== user.id,
  );
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    bannedUsers: banned,
    allowedUsers: allowed,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [ok(client, "Banned", `${user} can no longer join this channel.`)],
  });
}

async function handleUnban(client, interaction, ctx) {
  const user = interaction.options.getUser("user", true);
  await helper.applyClearUserOverwrite(ctx.channel, user.id);
  const banned = (ctx.tempRecord.bannedUsers || []).filter(
    (id) => id !== user.id,
  );
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    bannedUsers: banned,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [ok(client, "Unbanned", `${user} can now join again.`)],
  });
}

async function handleTransfer(client, interaction, ctx) {
  const user = interaction.options.getUser("user", true);
  if (user.id === interaction.user.id) {
    return interaction.editReply({
      embeds: [bad(client, "Cannot transfer", "You already own this channel.")],
    });
  }
  if (user.bot) {
    return interaction.editReply({
      embeds: [bad(client, "Cannot transfer", "Bots cannot own a TempVC.")],
    });
  }
  const target = interaction.guild.members.cache.get(user.id);
  if (!target || target.voice?.channelId !== ctx.channel.id) {
    return interaction.editReply({
      embeds: [
        bad(
          client,
          "Not in channel",
          `${user} is not in this channel; transfer is only allowed to current members.`,
        ),
      ],
    });
  }
  const updated = await tempVcService.transferOwnership(
    interaction.guildId,
    ctx.channel.id,
    user.id,
  );
  if (!updated) {
    return interaction.editReply({
      embeds: [
        bad(
          client,
          "Transfer failed",
          "Storage refused the update; please try again.",
        ),
      ],
    });
  }
  await ctx.channel.permissionOverwrites
    .edit(user.id, {
      Connect: true,
      Speak: true,
      ManageChannels: true,
      MoveMembers: true,
    })
    .catch(() => {});
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [ok(client, "Ownership transferred", `${user} is now the owner.`)],
  });
}

async function handleTemplate(client, interaction, ctx) {
  const templateId = interaction.options.getString("template", true);
  const template = await tempVcStorage.getTemplate(
    interaction.guildId,
    templateId,
  );
  if (!template) {
    return interaction.editReply({
      embeds: [
        bad(
          client,
          "Template not found",
          `No template with id \`${templateId}\`.`,
        ),
      ],
    });
  }
  const applied = await tempVcService.applyTemplate(
    interaction.guild,
    ctx.channel,
    templateId,
    interaction.guildId,
  );
  if (!applied) {
    return interaction.editReply({
      embeds: [
        bad(
          client,
          "Apply failed",
          "Could not apply template; check bot permissions.",
        ),
      ],
    });
  }
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [
      ok(
        client,
        "Template applied",
        `**${applied.name}** is now active on this channel.`,
      ),
    ],
  });
}

async function handleInfo(client, interaction, ctx) {
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
      .slice(0, 20)
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
}

const STR = ApplicationCommandOptionType.String;
const INT = ApplicationCommandOptionType.Integer;
const USR = ApplicationCommandOptionType.User;
const SUB = ApplicationCommandOptionType.Subcommand;

module.exports = {
  name: ["vc"],
  description: "Control your Temporary Voice Channel",
  category: "Voice",
  options: [
    {
      type: SUB,
      name: "rename",
      description: "Rename your TempVC",
      options: [
        {
          type: STR,
          name: "name",
          description: "New channel name",
          required: true,
        },
      ],
    },
    {
      type: SUB,
      name: "limit",
      description: "Set user limit (0 = unlimited)",
      options: [
        {
          type: INT,
          name: "number",
          description: "User limit",
          required: true,
          min_value: 0,
          max_value: 99,
        },
      ],
    },
    { type: SUB, name: "lock", description: "Prevent everyone from joining" },
    { type: SUB, name: "unlock", description: "Allow everyone to join" },
    {
      type: SUB,
      name: "hide",
      description: "Hide the channel from non-members",
    },
    { type: SUB, name: "show", description: "Reveal the channel to everyone" },
    {
      type: SUB,
      name: "allow",
      description: "Allow a user to join even when locked",
      options: [
        {
          type: USR,
          name: "user",
          description: "User to allow",
          required: true,
        },
      ],
    },
    {
      type: SUB,
      name: "kick",
      description: "Disconnect a user from your channel",
      options: [
        {
          type: USR,
          name: "user",
          description: "User to kick",
          required: true,
        },
      ],
    },
    {
      type: SUB,
      name: "ban",
      description: "Block a user from joining your channel",
      options: [
        { type: USR, name: "user", description: "User to ban", required: true },
      ],
    },
    {
      type: SUB,
      name: "unban",
      description: "Lift a previous ban",
      options: [
        {
          type: USR,
          name: "user",
          description: "User to unban",
          required: true,
        },
      ],
    },
    {
      type: SUB,
      name: "transfer",
      description: "Transfer ownership to another member",
      options: [
        {
          type: USR,
          name: "user",
          description: "New owner (must be in this channel)",
          required: true,
        },
      ],
    },
    {
      type: SUB,
      name: "template",
      description: "Apply a saved template to this channel",
      options: [
        {
          type: STR,
          name: "template",
          description: "Template ID",
          required: true,
        },
      ],
    },
    { type: SUB, name: "info", description: "Show details about your TempVC" },
  ],
  run: async (client, interaction) => {
    if (
      !interaction.guild ||
      interaction.guild.channels.cache.has(interaction.channelId) === false
    ) {
      // Defensive — interaction must come from a guild context.
    }

    await interaction.deferReply({ ephemeral: true });

    const ctx = await helper.validateOwner(interaction);
    if (!ctx) return;
    if (ctx.channel.type !== ChannelType.GuildVoice) {
      return interaction.editReply({
        embeds: [
          bad(
            client,
            "Wrong channel type",
            "This command only works in voice channels.",
          ),
        ],
      });
    }

    try {
      const sub = interaction.options.getSubcommand();
      switch (sub) {
        case "rename":
          return handleRename(client, interaction, ctx);
        case "limit":
          return handleLimit(client, interaction, ctx);
        case "lock":
          return handleLock(client, interaction, ctx, true);
        case "unlock":
          return handleLock(client, interaction, ctx, false);
        case "hide":
          return handleHide(client, interaction, ctx, true);
        case "show":
          return handleHide(client, interaction, ctx, false);
        case "allow":
          return handleAllow(client, interaction, ctx);
        case "kick":
          return handleKick(client, interaction, ctx);
        case "ban":
          return handleBan(client, interaction, ctx);
        case "unban":
          return handleUnban(client, interaction, ctx);
        case "transfer":
          return handleTransfer(client, interaction, ctx);
        case "template":
          return handleTemplate(client, interaction, ctx);
        case "info":
          return handleInfo(client, interaction, ctx);
        default:
          return interaction.editReply({ content: "Unknown subcommand." });
      }
    } catch (err) {
      logger.error(
        `/vc ${interaction.options.getSubcommand?.() || "?"} failed: ${err.message}`,
      );
      return interaction.editReply({
        embeds: [bad(client, "Command failed", Embeds.formatError(err))],
      });
    }
  },
};
