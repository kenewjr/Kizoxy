const {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const { replyError, replySuccess } = require("../../../lib/interactions");
const {
  buildVoiceRolesListEmbed,
  buildVoiceRolesListComponents,
  buildVoiceRoleConfigEmbed,
  buildVoiceRoleConfigComponents,
} = require("../panelBuilders/voiceRolesBuilder");

async function updateList(interaction, client) {
  const all = await tempVcStorage.getVoiceRoles(interaction.guildId);
  const embed = await buildVoiceRolesListEmbed(client, interaction.guildId);
  const components = buildVoiceRolesListComponents(all);
  const pay = { embeds: [embed], components, ephemeral: false };
  if (interaction.replied || interaction.deferred)
    return interaction.editReply(pay);
  return interaction.reply(pay);
}

async function showConfig(interaction, client, pending) {
  const embed = buildVoiceRoleConfigEmbed(client, pending.data);
  const components = buildVoiceRoleConfigComponents(pending.data);
  const pay = { embeds: [embed], components, ephemeral: false };
  if (interaction.replied || interaction.deferred)
    return interaction.editReply(pay);
  return interaction.reply(pay);
}

// ── Action handlers ──

async function handleList(ctx) {
  ctx.pendingConfigs.delete(ctx.key);
  return updateList(ctx.interaction, ctx.client);
}

async function handleAddFlow(ctx) {
  const settings = await tempVcStorage.getSettings(ctx.interaction.guildId);
  const existing = await tempVcStorage.getVoiceRoles(ctx.interaction.guildId);
  if (!settings.isPremium && existing.length >= settings.maxVoiceRoles) {
    return replyError(
      ctx.interaction,
      `Limit reached: max ${settings.maxVoiceRoles} voice roles.`,
    );
  }
  const row = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("tempvc_panel:vr_select_channel")
      .setPlaceholder("Select a voice channel...")
      .addChannelTypes(ChannelType.GuildVoice),
  );
  return ctx.interaction.reply({
    content: "Select the voice channel that will trigger role assignment:",
    components: [row],
    ephemeral: true,
  });
}

async function handleSelectChannel(ctx) {
  const { interaction, pendingConfigs, key } = ctx;
  const channelId = interaction.values[0];
  const channel = await interaction.guild.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    return replyError(
      interaction,
      "Set up a temporary voice channel generator or active channel.",
    );
  }
  pendingConfigs.set(key, {
    screen: "voice_role_config_role",
    mode: "add",
    editId: null,
    data: { channelId, roleId: null, ownerOnly: false, createdAt: Date.now() },
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  const row = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId("tempvc_panel:vr_select_role")
      .setPlaceholder("Select a role to assign..."),
  );
  return interaction.reply({
    content: `Channel selected: <#${channelId}>. Now select the role to assign:`,
    components: [row],
    ephemeral: true,
  });
}

async function handleSelectRole(ctx) {
  const { interaction, client, pending } = ctx;
  if (!pending || pending.screen !== "voice_role_config_role") {
    return replyError(interaction, "Session expired. Run `/tempvc` again.");
  }
  const roleId = interaction.values[0];
  const existing = await tempVcStorage.getVoiceRoles(interaction.guildId);
  const duplicate = existing.find(
    (vr) => vr.channelId === pending.data.channelId && vr.roleId === roleId,
  );
  if (duplicate) {
    return replyError(
      interaction,
      "That role is already attached to this channel.",
    );
  }
  const me = interaction.guild.members.me;
  const role = await interaction.guild.roles.fetch(roleId);
  if (me && role && role.position >= me.roles.highest.position) {
    return replyError(
      interaction,
      "I can't manage this role because it sits at or above my highest role.",
    );
  }
  if (role && role.managed) {
    return replyError(
      interaction,
      "This role is managed by an integration and can't be assigned manually.",
    );
  }
  pending.data.roleId = roleId;
  pending.screen = "voice_role_config";
  await interaction.reply({
    content: "Role selected successfully.",
    ephemeral: true,
  });
  return showConfig(interaction, client, pending);
}

async function handleToggleOwner(ctx) {
  ctx.pending.data.ownerOnly = !ctx.pending.data.ownerOnly;
  await ctx.interaction.deferUpdate();
  return showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleSave(ctx) {
  const { interaction, pendingConfigs, key, client, pending } = ctx;
  await tempVcStorage.addVoiceRole(interaction.guildId, pending.data);
  await replySuccess(interaction, "Voice role attachment successfully added.");
  pendingConfigs.delete(key);
  return updateList(interaction, client);
}

async function handleSelectToRemove(ctx) {
  const id = ctx.interaction.values[0].split(":")[1];
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tempvc_panel:vr_remove_confirm:${id}`)
      .setLabel("Yes, Remove")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:vr_cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
  return ctx.interaction.reply({
    content: "Are you sure you want to detach this voice role?",
    components: [row],
    ephemeral: true,
  });
}

async function handleRemoveConfirm(ctx) {
  await tempVcStorage.removeVoiceRole(ctx.interaction.guildId, ctx.rest[0]);
  await replySuccess(ctx.interaction, "Successfully detached voice role.");
  ctx.pendingConfigs.delete(ctx.key);
  return updateList(ctx.interaction, ctx.client);
}

// ── Action map ──
const PRE_SESSION = {
  voice_roles: handleList,
  vr_cancel: handleList,
  vr_add_flow: handleAddFlow,
  vr_select_channel: handleSelectChannel,
  vr_select_role: handleSelectRole,
};

const SESSION_ACTIONS = {
  vr_toggle_owner_btn: handleToggleOwner,
  vr_save: handleSave,
  vr_select_to_remove: handleSelectToRemove,
};

async function execute(interaction, client, pendingConfigs, action, rest) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const pending = pendingConfigs.get(key);
  const ctx = {
    interaction,
    client,
    pendingConfigs,
    key,
    pending,
    action,
    rest,
  };

  const preFn = PRE_SESSION[action];
  if (preFn) return preFn(ctx);

  if (action.startsWith("vr_remove_confirm")) {
    return handleRemoveConfirm(ctx);
  }

  if (!pending || pending.screen !== "voice_role_config") {
    return replyError(
      interaction,
      "Your session has expired. Please run `/tempvc` again.",
    );
  }

  const fn = SESSION_ACTIONS[action];
  if (fn) return fn(ctx);
}

module.exports = { execute };
