const { ApplicationCommandOptionType } = require("discord.js");
const Embeds = require("../../../lib/embeds");

const EPHEMERAL_TTL_MS = 3000;

module.exports = {
  name: ["skip"],
  description: "Skip the current song and play the next one.",
  category: "Music",
  options: [
    {
      name: "position",
      description:
        "The position in queue to skip to (leave empty to skip current song)",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      min_value: 1,
    },
  ],
  run: async (client, interaction) => {
    const player = client.manager.players.get(interaction.guild.id);
    if (!player) {
      await interaction.reply({
        content: "No playing in this guild!",
        ephemeral: true,
      });
      return;
    }

    const { channel } = interaction.member.voice;
    if (
      !channel ||
      interaction.member.voice.channel !==
        interaction.guild.members.me.voice.channel
    ) {
      await interaction.reply({
        content: "I'm not in the same voice channel as you!",
        ephemeral: true,
      });
      return;
    }

    const position = interaction.options.getInteger("position");

    if (!position) {
      await player.skip();

      const embed = Embeds.brand(client, {
        description: "`⏭` | *Song has been:* `Skipped`",
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });

      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (_err) {
          // Ignore error if already deleted
        }
      }, EPHEMERAL_TTL_MS);
      return;
    }

    if (
      position > player.queue.size ||
      (position && !player.queue[position - 1])
    ) {
      await interaction.reply({
        content: `You can't skip to a song that doesn't exist! The queue only has ${player.queue.size} song(s).`,
        ephemeral: true,
      });

      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (_err) {
          // Ignore error if already deleted
        }
      }, EPHEMERAL_TTL_MS);
      return;
    }

    if (position === 1) {
      await player.skip();
    } else {
      await player.queue.splice(0, position - 1);
      await player.skip();
    }

    const embed = Embeds.brand(client, {
      description: `\`⏭\` | *Skipped to position:* \`${position}\``,
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });

    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (_err) {
        // Ignore error if already deleted
      }
    }, EPHEMERAL_TTL_MS);
  },
};
