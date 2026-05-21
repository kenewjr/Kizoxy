const {
  ApplicationCommandOptionType,
  AttachmentBuilder,
} = require("discord.js");
const { RankCardBuilder, Font } = require("canvacord");
const LevelStorage = require("../../../persistence/levelStorage");

if (Font?.loadDefault) Font.loadDefault();

module.exports = {
  name: ["rank"],
  description: "View your current level and XP",
  category: "Level",
  options: [
    {
      name: "user",
      description: "The user to view rank for",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],
  run: async (client, interaction) => {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("user") || interaction.user;

    // Initialize storage if needed
    if (!client.levelStorage) {
      client.levelStorage = new LevelStorage();
    }

    const userData = await client.levelStorage.getUser(
      targetUser.id,
      interaction.guildId,
    );

    // Default values if user has no data
    const user = userData || {
      xp: 0,
      level: 0,
      userId: targetUser.id,
      guildId: interaction.guildId,
    };

    // Calculate required XP for next level
    const requiredXp = 5 * Math.pow(user.level, 2) + 50 * user.level + 100;

    // Get rank position
    const rank =
      (await client.levelStorage.getRank(targetUser.id, interaction.guildId)) ||
      0;

    const rankCard = new RankCardBuilder()
      .setAvatar(targetUser.displayAvatarURL({ extension: "png", size: 512 }))
      .setCurrentXP(user.xp)
      .setRequiredXP(requiredXp)
      .setLevel(user.level)
      .setStatus(
        interaction.guild.members.cache.get(targetUser.id)?.presence?.status ||
          "offline",
      )
      .setUsername(targetUser.username)
      .setDisplayName(targetUser.displayName)
      .setRank(typeof rank === "number" ? rank : 0);

    const data = await rankCard.build();
    const attachment = new AttachmentBuilder(data, { name: "rank.png" });

    return interaction.editReply({ files: [attachment] });
  },
};
