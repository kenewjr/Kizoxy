const {
  buildAlarmListEmbed,
  buildAlarmListComponents,
} = require("../../../services/alarm/alarmFormatter");
const Logger = require("../../../utils/logger");

const logger = new Logger("ALARM");

module.exports = {
  name: ["alarm"],
  description: "Open the alarm panel (view, create, edit, cancel, toggle)",
  category: "Alarm",
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false });

    try {
      const alarms = await client.alarmScheduler.storage.findByUser(
        interaction.user.id,
      );

      if (alarms.length === 0) {
        return interaction.editReply("❌ You don't have any active alarms.");
      }

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
