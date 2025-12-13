const {
  ApplicationCommandOptionType,
  EmbedBuilder,
} = require("discord.js");
const LevelStorage = require("../../../utils/levelStorage");

module.exports = {
  name: ["level"],
  description: "Level system commands",
  category: "Level",
  options: [
    {
      name: "add",
      description: "Add XP to a user (Owner Only)",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "The user to add XP to",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "amount",
          description: "Amount of XP to add",
          type: ApplicationCommandOptionType.Integer,
          required: true,
        },
      ],
    },
  ],
  run: async (client, interaction) => {
    // Check if user is owner
    if (interaction.user.id !== client.owner) {
      return interaction.reply({
        content: "❌ Access Denied: This command is restricted to the bot owner.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "add") {
      const targetUser = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");

      if (!client.levelStorage) {
        client.levelStorage = new LevelStorage();
      }

      try {
        const result = await client.levelStorage.addXp(targetUser.id, interaction.guildId, amount);
        
        const embed = new EmbedBuilder()
          .setColor(client.color)
          .setTitle("✅ XP Added")
          .setDescription(
            `Successfully added **${amount} XP** to ${targetUser}.\n` +
            `Current Level: **${result.level}**\n` +
            `Current XP: **${result.user.xp}**`
          );

        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error("Error adding XP manually:", error);
        return interaction.editReply("❌ Failed to add XP due to an error.");
      }
    }
  },
};
