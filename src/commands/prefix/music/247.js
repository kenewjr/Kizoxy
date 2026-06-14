const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");
const {
  validateMusicContextMessage,
} = require("../../../features/music/musicHelper");

const logger = new Logger("PREFIX-247");

module.exports = {
  name: "247",
  aliases: ["twentyfourseven", "stay"],
  description: "Toggle 24/7 mode (bot stays in the voice channel).",
  category: "music",
  run: async (client, message) => {
    const ctx = validateMusicContextMessage(client, message);
    if (ctx.error) return message.reply(ctx.error);

    try {
      const { player } = ctx;
      const active = !player.data.get("stay");
      player.data.set("stay", active);

      const embed = Embeds.brand(client, {
        description: active
          ? "`🌕` | *Mode 24/7 has been:* `Activated`"
          : "`🌙` | *Mode 24/7 has been:* `Deactivated`",
      });
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`k247 failed: ${err.message}`);
      return message.reply("❌ Failed to toggle 24/7 mode.");
    }
  },
};
