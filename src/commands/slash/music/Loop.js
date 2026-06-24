const { ApplicationCommandOptionType } = require("discord.js");
const Embeds = require("../../../lib/embeds");

module.exports = {
  name: ["music", "loop"],
  description: "Cycle loop mode (off, track, queue).",
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
    const player = client.manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply(`No playing in this guild!`);

    const { channel } = interaction.member.voice;
    if (
      !channel ||
      interaction.member.voice.channel !==
        interaction.guild.members.me.voice.channel
    )
      return interaction.reply(`I'm not in the same voice channel as you!`);

    const choice = interaction.options.getString("mode");
    let loopType, message;

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

    player.setLoop(loopType);
    const embed = Embeds.brand(client, { description: message });

    interaction.reply({ embeds: [embed] });
  },
};
