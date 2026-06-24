const { ApplicationCommandOptionType } = require("discord.js");
const playLogic = require("../../../features/music/playLogic");

module.exports = {
  name: ["play"],
  description: "Play a track or playlist from YouTube, Spotify, SoundCloud, or Deezer.",
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
