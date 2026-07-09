const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ChannelType,
} = require("discord.js");
const { replyError, replySuccess } = require("../../lib/interactions");
const tiktokStorage = require("../../persistence/tiktokStorage");
const { resolveProfile } = require("../../integrations/tiktok/resolver");
const Embeds = require("../../lib/embeds");
const Logger = require("../../lib/logger");

const logger = new Logger("TIKTOK");

function findChannel(guild, input) {
  const clean = input.trim();
  let channel = guild.channels.cache.get(clean);
  if (channel) return channel;
  const mentionMatch = clean.match(/^<#(\d+)>$/);
  if (mentionMatch) {
    channel = guild.channels.cache.get(mentionMatch[1]);
    if (channel) return channel;
  }
  const nameOnly = clean.replace(/^#/, "").toLowerCase();
  return guild.channels.cache.find(
    (c) =>
      c.name.toLowerCase() === nameOnly &&
      (c.type === ChannelType.GuildText ||
        c.type === ChannelType.GuildAnnouncement),
  );
}

function findRole(guild, input) {
  if (!input) return null;
  const clean = input.trim();
  if (!clean) return null;
  let role = guild.roles.cache.get(clean);
  if (role) return role;
  const mentionMatch = clean.match(/^<@&(\d+)>$/);
  if (mentionMatch) {
    role = guild.roles.cache.get(mentionMatch[1]);
    if (role) return role;
  }
  const nameOnly = clean.replace(/^@/, "").toLowerCase();
  return guild.roles.cache.find((r) => r.name.toLowerCase() === nameOnly);
}

async function renderListView(
  client,
  interaction,
  editMessageDirectly = false,
) {
  const subscriptions = await tiktokStorage.listSubscriptions(
    interaction.guild.id,
  );
  const { buildListEmbed } = require("../../commands/slash/tiktok/list");
  const {
    totalPages,
    LIST_PAGE_SIZE,
    buildPaginationRow,
  } = require("../../features/alarm/alarmFormatter");

  const page = 0;
  const embed = buildListEmbed(client, subscriptions, page);
  const total = totalPages(subscriptions, LIST_PAGE_SIZE);

  const controlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tiktok_panel:add")
      .setLabel("Add Account")
      .setStyle(ButtonStyle.Success)
      .setEmoji("➕"),
    new ButtonBuilder()
      .setCustomId("tiktok_panel:remove")
      .setLabel("Remove Account")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("❌"),
  );

  const components = [];
  if (total > 1) {
    components.push(buildPaginationRow("tiktok_list_page", page, total));
  }
  components.push(controlRow);

  if (editMessageDirectly && interaction.message) {
    await interaction.message.edit({ embeds: [embed], components });
  } else {
    await interaction.editReply({ embeds: [embed], components });
  }
}

module.exports = {
  customId: "tiktok_panel",
  execute: async (interaction, client) => {
    try {
      if (!interaction.memberPermissions?.has?.("ManageGuild")) {
        return replyError(
          interaction,
          "You need the **Manage Server** permission to use this panel.",
        );
      }

      const customId = interaction.customId;

      // 1. Show Add Modal
      if (customId === "tiktok_panel:add") {
        const modal = new ModalBuilder()
          .setCustomId("tiktok_panel:add_modal")
          .setTitle("Add TikTok Subscription");

        const tiktokInput = new TextInputBuilder()
          .setCustomId("tiktok_url")
          .setLabel("TikTok Profile / URL / @Username")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. @therock or https://www.tiktok.com/@therock")
          .setRequired(true);

        const announceInput = new TextInputBuilder()
          .setCustomId("announce_channel")
          .setLabel("Discord Channel Name or ID")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. #tiktok or 123456789012345678")
          .setRequired(true);

        const mentionInput = new TextInputBuilder()
          .setCustomId("mention_role")
          .setLabel("Role Name or ID to Ping (Optional)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. @PingRole or 987654321098765432")
          .setRequired(false);

        const configInput = new TextInputBuilder()
          .setCustomId("notifications")
          .setLabel("Notify Videos, Live (Y/N)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. Y, Y (default all Yes)")
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(tiktokInput),
          new ActionRowBuilder().addComponents(announceInput),
          new ActionRowBuilder().addComponents(mentionInput),
          new ActionRowBuilder().addComponents(configInput),
        );

        return await interaction.showModal(modal);
      }

      // 2. Add Modal Submit
      if (customId === "tiktok_panel:add_modal") {
        await interaction.deferReply({ ephemeral: true });
        const tiktokInput = interaction.fields.getTextInputValue("tiktok_url");
        const announceInput =
          interaction.fields.getTextInputValue("announce_channel");
        const roleInput = interaction.fields.getTextInputValue("mention_role");
        const notifInput =
          interaction.fields.getTextInputValue("notifications");

        const announceChannel = findChannel(interaction.guild, announceInput);
        if (!announceChannel) {
          return replyError(
            interaction,
            "Could not find that Discord channel. Please make sure it's a valid text or announcement channel in this server.",
          );
        }

        const mentionRole = findRole(interaction.guild, roleInput);
        if (roleInput && !mentionRole) {
          return replyError(
            interaction,
            "Could not find that role. Please leave it blank or make sure the role exists.",
          );
        }

        let resolved;
        try {
          resolved = resolveProfile(tiktokInput);
        } catch (err) {
          return replyError(interaction, err.message);
        }

        const existing = await tiktokStorage.findByUsername(
          interaction.guild.id,
          resolved.username,
        );
        if (existing) {
          return replyError(
            interaction,
            `This server is already subscribed to **@${resolved.username}**.`,
          );
        }

        let notifyVideos = true;
        let notifyLive = true;
        if (notifInput) {
          const parts = notifInput
            .split(",")
            .map((p) => p.trim().toLowerCase());
          if (parts.length >= 1 && parts[0]) {
            notifyVideos = !parts[0].startsWith("n");
          }
          if (parts.length >= 2 && parts[1]) {
            notifyLive = !parts[1].startsWith("n");
          }
        }

        try {
          await tiktokStorage.addSubscription(interaction.guild.id, {
            username: resolved.username,
            profileUrl: resolved.profileUrl,
            discordChannelId: announceChannel.id,
            mentionRoleId: mentionRole?.id ?? null,
            notifyVideos,
            notifyLive,
          });

          // Re-render list view in original message
          if (interaction.message) {
            await renderListView(client, interaction, true);
          }

          return replySuccess(
            interaction,
            `Subscribed to **@${resolved.username}** — notifications will post in <#${announceChannel.id}>.`,
          );
        } catch (err) {
          logger.error(`Failed to add subscription: ${err.message}`);
          return replyError(
            interaction,
            "Failed to save the subscription. Please try again.",
          );
        }
      }

      // 3. Show Remove Options (In-Place)
      if (customId === "tiktok_panel:remove") {
        const subscriptions = await tiktokStorage.listSubscriptions(
          interaction.guild.id,
        );
        if (!subscriptions.length) {
          return replyError(
            interaction,
            "There are no active subscriptions to remove.",
          );
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId("tiktok_panel:remove_select")
          .setPlaceholder("Select a TikTok account to unsubscribe...")
          .addOptions(
            subscriptions.slice(0, 25).map((sub) => ({
              label: `@${sub.username}`.slice(0, 100),
              description: `Profile URL: ${sub.profileUrl.slice(0, 50)}`,
              value: sub.id,
            })),
          );

        const embed = Embeds.brand(client, {
          title: "Remove Subscription",
          description:
            "Select a TikTok account from the dropdown below to unsubscribe it from this server.",
        });

        const controlRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("tiktok_panel:cancel")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary),
        );

        await interaction.editReply({
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(menu), controlRow],
        });
        return;
      }

      // 4. Cancel Remove (In-Place)
      if (customId === "tiktok_panel:cancel") {
        await renderListView(client, interaction);
        return;
      }

      // 5. Process Remove Submit
      if (customId === "tiktok_panel:remove_select") {
        const subscriptionId = interaction.values[0];
        const subscriptions = await tiktokStorage.listSubscriptions(
          interaction.guild.id,
        );
        const sub = subscriptions.find((s) => s.id === subscriptionId);

        if (sub) {
          await tiktokStorage.removeSubscription(
            interaction.guild.id,
            subscriptionId,
          );
          logger.info(
            `Removed TikTok subscription @${sub.username} in guild ${interaction.guild.id}`,
          );
        }

        await renderListView(client, interaction);
      }
    } catch (err) {
      logger.error(`Error in tiktok_panel execution: ${err.message}`);
    }
  },
};
