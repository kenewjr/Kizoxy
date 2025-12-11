const { ApplicationCommandOptionType } = require("discord.js");
const playLogic = require("../../Shared/Music/playLogic.js");

module.exports = {
  name: ["play"],
  description: "Play a song from YouTube, SoundCloud, etc.",
  category: "Music",
  options: [
    {
      name: "search",
      type: ApplicationCommandOptionType.String,
      description: "Song name or URL",
      required: true,
      autocomplete: true,
    },
  ],
  run: async (client, interaction) => {
    await playLogic(client, interaction, []);
  },
};
