const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");

module.exports = {
  name: ["music", "loop"],
  description: "Loops the current song!",
  category: "Music",
  options: [
    {
      name: "mode",
      description: "What mode do you want to loop?",
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        {
          name: "Current 🔂",
          value: "current",
        },
        {
          name: "Queue 🔁",
          value: "queue",
        },
      ],
    },
  ],
  run: async (client, interaction) => {
    // Check if player exists
    const player = client.manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply(`No playing in this guild!`);

    // Check if user is in same voice channel
    const { channel } = interaction.member.voice;
    if (
      !channel ||
      interaction.member.voice.channel !==
        interaction.guild.members.me.voice.channel
    )
      return interaction.reply(`I'm not in the same voice channel as you!`);

    const choice = interaction.options.getString("mode");
    let loopType, currentLoop, message;

    // Determine loop type and message based on choice
    if (choice === "current") {
      loopType = player.loop === "track" ? "none" : "track";
      message =
        loopType === "track"
          ? `\`�\` | *Current song:* \`Looped\``
          : `\`🔂\` | *Current song:* \`Unlooped\``;
    } else if (choice === "queue") {
      loopType = player.loop === "queue" ? "none" : "queue";
      message =
        loopType === "queue"
          ? `\`🔁\` | *Loop queue:* \`Enabled\``
          : `\`🔁\` | *Loop queue:* \`Disabled\``;
    }

    // Set loop and send response
    player.setLoop(loopType);
    const embed = new EmbedBuilder()
      .setDescription(message)
      .setColor(client.color);

    interaction.reply({ embeds: [embed] });
  },
};
