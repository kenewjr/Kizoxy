const {
  buildAlarmListEmbed,
  buildAlarmListComponents,
} = require("../../../features/alarm/alarmFormatter");
const Logger = require("../../../lib/logger");

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

      // Always render the panel — even with zero alarms — so the "New"
      // button stays reachable for first-time users. Destructive actions
      // (Cancel/Edit/Toggle) are auto-disabled inside the component builder
      // when there are no alarms.
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
