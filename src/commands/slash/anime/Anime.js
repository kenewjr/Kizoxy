const {
  ApplicationCommandOptionType,
  ChannelType,
} = require("discord.js");
const Embeds = require("../../../lib/embeds");
const {
  getTodaySchedule,
  formatAnimeEmbed,
  chunkArray,
} = require("../../../integrations/jikan");
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../../../../data/jikan-schedule.json");

module.exports = {
  name: ["anime"],
  description: "Anime related commands",
  category: "Anime",
  options: [
    {
      name: "schedule",
      description: "Anime schedule commands",
      type: ApplicationCommandOptionType.SubcommandGroup,
      options: [
        {
          name: "set",
          description: "Set the channel for automatic daily schedule updates",
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "channel",
              description: "The channel to post updates to",
              type: ApplicationCommandOptionType.Channel,
              channelTypes: [ChannelType.GuildText],
              required: true,
            },
          ],
        },
        {
          name: "view",
          description: "View today's anime schedule",
          type: ApplicationCommandOptionType.Subcommand,
        },
      ],
    },
  ],
  run: async (client, interaction) => {
    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (group === "schedule") {
      if (subcommand === "set") {
        const channel = interaction.options.getChannel("channel");

        let data = {};
        try {
          if (fs.existsSync(DATA_PATH)) {
            data = JSON.parse(fs.readFileSync(DATA_PATH));
          }
        } catch (err) {
          console.error("Error reading schedule data:", err);
        }

        data[interaction.guildId] = {
          channelId: channel.id,
          updatedAt: new Date().toISOString(),
        };

        try {
          const dirPath = path.dirname(DATA_PATH);
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }
          fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

          const embed = Embeds.brand(client, {
            title: "✅ Schedule Channel Set",
            description: `Daily anime schedules will now be posted in ${channel}.`,
          });

          return interaction.reply({ embeds: [embed] });
        } catch (err) {
          console.error("Error writing schedule data:", err);
          return interaction.reply({
            content: "❌ Failed to save configuration.",
            ephemeral: true,
          });
        }
      } else if (subcommand === "view") {
        await interaction.deferReply();

        try {
          const response = await getTodaySchedule();
          const data = response.data; // Jikan API returns { data: [...] }

          if (!data || data.length === 0) {
            return interaction.editReply("No anime scheduled for today.");
          }

          const allEmbeds = data.map((anime) => formatAnimeEmbed(anime));

          const embedChunks = chunkArray(allEmbeds, 10);

          const days = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ];
          const date = new Date();
          const dayName = days[date.getDay()];
          const dateNum = date.getDate();
          await interaction.editReply({
            content: `📅 **Anime Update Schedule for ${dayName} (Day ${dateNum})**`,
          });

          for (const chunk of embedChunks) {
            await interaction.channel.send({ embeds: chunk });
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (err) {
          console.error("Error fetching schedule:", err);
          return interaction.editReply({
            content: "❌ Failed to fetch schedule.",
          });
        }
      }
    }
  },
};
