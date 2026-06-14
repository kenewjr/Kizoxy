const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");
const {
  validateMusicContextMessage,
} = require("../../../features/music/musicHelper");

const logger = new Logger("PREFIX-LOOP");

const LOOP_MODES = ["off", "track", "queue"];

module.exports = {
  name: "loop",
  aliases: ["repeat"],
  description: "Toggle loop mode. Usage: kloop [current|queue|off]",
  category: "music",
  run: async (client, message, args) => {
    const ctx = validateMusicContextMessage(client, message);
    if (ctx.error) return message.reply(ctx.error);

    try {
      const { player } = ctx;
      const mode = (args[0] || "").toLowerCase();

      let loopType;
      let description;
      if (mode === "queue") {
        loopType = player.loop === "queue" ? "none" : "queue";
        description =
          loopType === "queue"
            ? "`🔁` | *Loop queue:* `Enabled`"
            : "`🔁` | *Loop queue:* `Disabled`";
      } else if (mode === "off" || mode === "none") {
        loopType = "none";
        description = "`➡` | *Loop:* `Disabled`";
      } else {
        // default: toggle current track loop
        loopType = player.loop === "track" ? "none" : "track";
        description =
          loopType === "track"
            ? "`🔂` | *Current song:* `Looped`"
            : "`🔂` | *Current song:* `Unlooped`";
      }

      player.setLoop(loopType);
      const embed = Embeds.brand(client, { description });
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`kloop failed: ${err.message}`);
      return message.reply("❌ Failed to set loop mode.");
    }
  },
  LOOP_MODES,
};
