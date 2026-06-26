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
const youtubeStorage = require("../../persistence/youtubeStorage");
const { resolveChannel } = require("../../integrations/youtube/client");
const Embeds = require("../../lib/embeds");
const Logger = require("../../lib/logger");

const logger = new Logger("YOUTUBE");

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

async function renderListView(client, interaction) {
  const subscriptions = await youtubeStorage.listSubscriptions(
    interaction.guild.id,
  );
  const { buildListEmbed } = require("../../commands/slash/youtube/list");
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
      .setCustomId("youtube_panel:add")
      .setLabel("Add Channel")
      .setStyle(ButtonStyle.Success)
      .setEmoji("➕"),
    new ButtonBuilder()
      .setCustomId("youtube_panel:remove")
      .setLabel("Remove Channel")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("❌"),
  );

  const components = [];
  if (total > 1) {
    components.push(buildPaginationRow("youtube_list_page", page, total));
  }
  components.push(controlRow);

  await interaction.editReply({ embeds: [embed], components });
}

module.exports = {
  customId: "youtube_panel",
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
      if (customId === "youtube_panel:add") {
        const modal = new ModalBuilder()
          .setCustomId("youtube_panel:add_modal")
          .setTitle("Add YouTube Subscription");

        const channelInput = new TextInputBuilder()
          .setCustomId("channel")
          .setLabel("YouTube Channel / URL / @Handle")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. @ayundarisu or https://youtube.com/@ayundarisu")
          .setRequired(true);

        const announceInput = new TextInputBuilder()
          .setCustomId("announce_channel")
          .setLabel("Discord Channel Name or ID")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. #yt or 123456789012345678")
          .setRequired(true);

        const mentionInput = new TextInputBuilder()
          .setCustomId("mention_role")
          .setLabel("Role Name or ID to Ping (Optional)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. @PingRole or 987654321098765432")
          .setRequired(false);

        const configInput = new TextInputBuilder()
          .setCustomId("notifications")
          .setLabel("Notify Videos, Shorts, Live (Y/N)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. Y, Y, Y (default all Yes)")
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(channelInput),
          new ActionRowBuilder().addComponents(announceInput),
          new ActionRowBuilder().addComponents(mentionInput),
          new ActionRowBuilder().addComponents(configInput),
        );

        return await interaction.showModal(modal);
      }

      // 2. Add Modal Submit
      if (customId === "youtube_panel:add_modal") {
        const channelInput = interaction.fields.getTextInputValue("channel");
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
          resolved = await resolveChannel(channelInput);
        } catch (err) {
          return replyError(interaction, err.message);
        }

        const existing = await youtubeStorage.findByYoutubeChannel(
          interaction.guild.id,
          resolved.youtubeChannelId,
        );
        if (existing) {
          return replyError(
            interaction,
            `This server is already subscribed to **${resolved.youtubeChannelTitle}**.`,
          );
        }

        let notifyVideos = true;
        let notifyShorts = true;
        let notifyLive = true;
        if (notifInput) {
          const parts = notifInput
            .split(",")
            .map((p) => p.trim().toLowerCase());
          if (parts.length >= 1 && parts[0]) {
            notifyVideos = !parts[0].startsWith("n");
          }
          if (parts.length >= 2 && parts[1]) {
            notifyShorts = !parts[1].startsWith("n");
          }
          if (parts.length >= 3 && parts[2]) {
            notifyLive = !parts[2].startsWith("n");
          }
        }

        try {
          await youtubeStorage.addSubscription(interaction.guild.id, {
            youtubeChannelId: resolved.youtubeChannelId,
            youtubeChannelTitle: resolved.youtubeChannelTitle,
            youtubeChannelUrl: `https://www.youtube.com/channel/${resolved.youtubeChannelId}`,
            announceChannelId: announceChannel.id,
            mentionRoleId: mentionRole?.id ?? null,
            notifyVideos,
            notifyShorts,
            notifyLive,
          });

          // Re-render list view in original message
          if (interaction.message) {
            await renderListView(client, interaction);
          }

          return replySuccess(
            interaction,
            `Subscribed to **${resolved.youtubeChannelTitle}** — announcements will post in <#${announceChannel.id}>.`,
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
      if (customId === "youtube_panel:remove") {
        const subscriptions = await youtubeStorage.listSubscriptions(
          interaction.guild.id,
        );
        if (!subscriptions.length) {
          return replyError(
            interaction,
            "There are no active subscriptions to remove.",
          );
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId("youtube_panel:remove_select")
          .setPlaceholder("Select a YouTube channel to unsubscribe...")
          .addOptions(
            subscriptions.slice(0, 25).map((sub) => ({
              label: sub.youtubeChannelTitle.slice(0, 100),
              description: `ID: ${sub.youtubeChannelId.slice(0, 50)}`,
              value: sub.id,
            })),
          );

        const embed = Embeds.brand(client, {
          title: "Remove Subscription",
          description:
            "Select a YouTube channel from the dropdown below to unsubscribe it from this server.",
        });

        const controlRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("youtube_panel:cancel")
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
      if (customId === "youtube_panel:cancel") {
        await renderListView(client, interaction);
        return;
      }

      // 5. Process Remove Submit
      if (customId === "youtube_panel:remove_select") {
        const subscriptionId = interaction.values[0];
        const subscriptions = await youtubeStorage.listSubscriptions(
          interaction.guild.id,
        );
        const sub = subscriptions.find((s) => s.id === subscriptionId);

        if (sub) {
          await youtubeStorage.removeSubscription(
            interaction.guild.id,
            subscriptionId,
          );
          logger.info(
            `Removed YouTube subscription ${sub.youtubeChannelTitle} in guild ${interaction.guild.id}`,
          );
        }

        await renderListView(client, interaction);
      }
    } catch (err) {
      logger.error(`Error in youtube_panel execution: ${err.message}`);
    }
  },
};
