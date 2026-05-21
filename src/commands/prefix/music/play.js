const playLogic = require("../../../features/music/playLogic");

module.exports = {
  name: "play",
  aliases: ["p"],
  description: "Play a song from YouTube, SoundCloud, etc.",
  category: "Music",
  run: async (client, message, args) => {
    await playLogic(client, message, args);
  },
};
