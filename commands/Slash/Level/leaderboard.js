const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ApplicationCommandOptionType,
} = require("discord.js");
const LevelStorage = require("../../../utils/levelStorage");

module.exports = {
  name: ["leaderboard"],
  description: "View the server leaderboard",
  category: "Level",
  run: async (client, interaction) => {
    await interaction.deferReply();

    if (!client.levelStorage) {
      client.levelStorage = new LevelStorage();
    }

    const leaderboard = await client.levelStorage.getLeaderboard(
      interaction.guildId,
    );

    if (!leaderboard || leaderboard.length === 0) {
      return interaction.editReply("❌ No data available for leaderboard yet.");
    }

    // Pagination variables
    const itemsPerPage = 10;
    let currentPage = 0;
    const totalPages = Math.ceil(leaderboard.length / itemsPerPage);

    // Get user's own rank for footer
    const userRank =
      leaderboard.findIndex((u) => u.userId === interaction.user.id) + 1;
    const userData = leaderboard.find((u) => u.userId === interaction.user.id);
    const selfRankText =
      userRank > 0
        ? `You are ranked #${userRank} • Level ${userData.level} • ${userData.xp} XP`
        : "You are not ranked yet.";

    const generateEmbed = async (page) => {
      const start = page * itemsPerPage;
      const end = start + itemsPerPage;
      const currentItems = leaderboard.slice(start, end);

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Leaderboard - ${interaction.guild.name}`)
        .setColor(client.color)
        .setFooter({ text: `Page ${page + 1}/${totalPages} • ${selfRankText}` })
        .setTimestamp();

      let description = "";

      for (let i = 0; i < currentItems.length; i++) {
        const item = currentItems[i];
        const position = start + i + 1;

        // Fetch user tag (might need to fetch from cache/API)
        let userTag = "Unknown User";
        try {
          const user = await client.users.fetch(item.userId);
          userTag = user.tag;
        } catch (e) {
          userTag = `User (${item.userId})`;
        }

        // Add medal emoji for top 3
        let prefix = `#${position}`;
        if (position === 1) prefix = "🥇";
        else if (position === 2) prefix = "🥈";
        else if (position === 3) prefix = "🥉";

        description += `**${prefix}** • **${userTag}**\nLevel ${item.level} • ${item.xp} XP\n\n`;
      }

      embed.setDescription(description);
      return embed;
    };

    const generateButtons = (page) => {
      const row = new ActionRowBuilder();

      const prevBtn = new ButtonBuilder()
        .setCustomId("prev_page")
        .setLabel("Previous")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0);

      const nextBtn = new ButtonBuilder()
        .setCustomId("next_page")
        .setLabel("Next")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === totalPages - 1);

      row.addComponents(prevBtn, nextBtn);
      return row;
    };

    const initialEmbed = await generateEmbed(currentPage);
    const initialButtons = generateButtons(currentPage);

    const message = await interaction.editReply({
      embeds: [initialEmbed],
      components: [initialButtons],
    });

    // Create collector
    const collector = message.createMessageComponentCollector({
      time: 60000, // 1 minute timeout
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: "❌ These buttons are not for you.",
          ephemeral: true,
        });
      }

      if (i.customId === "prev_page") {
        currentPage--;
      } else if (i.customId === "next_page") {
        currentPage++;
      }

      await i.update({
        embeds: [await generateEmbed(currentPage)],
        components: [generateButtons(currentPage)],
      });
    });

    collector.on("end", () => {
      // Disable buttons
      const disabledRow = new ActionRowBuilder();
      const prevBtn = new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
      const nextBtn = new ButtonBuilder()
        .setCustomId("next")
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
      disabledRow.addComponents(prevBtn, nextBtn);

      interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  },
};
