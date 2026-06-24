const {
  buildAlarmListEmbed,
  buildAlarmListComponents,
} = require("../../../features/alarm/alarmFormatter");
const Logger = require("../../../lib/logger");

const logger = new Logger("ALARM");

module.exports = {
  name: ["alarm"],
  description: "Show this server's alarm control panel.",
  category: "Alarm",
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false });

    try {
      const alarms = await client.alarmScheduler.storage.findByUser(
        interaction.user.id,
      );

      const page = 0;
      const embed = buildAlarmListEmbed(
        alarms,
        client.color,
        client.user.displayAvatarURL(),
        page,
      );

      await interaction.editReply({
        embeds: [embed],
        components: buildAlarmListComponents(alarms, page),
      });
    } catch (error) {
      logger.error(
        `Error listing alarms for user ${interaction.user.id}: ${error.message}`,
      );
      await interaction.editReply(
        "❌ An error occurred while fetching your alarm list.",
      );
    }
  },
};
