const router = require("express").Router();
const Logger = require("../../lib/logger");

const logger = new Logger("DASHBOARD-ALARMS");

// PATCH /api/guilds/:id/alarms/:alarmId
router.patch("/:id/alarms/:alarmId", async (req, res) => {
  try {
    const { id, alarmId } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const alarm = await client.alarmStorage.get(alarmId);
    if (!alarm || alarm.guildId !== id) {
      return res.status(404).json({ error: "Alarm not found in this guild" });
    }

    const { message, time, date, recurring, channelId, roleId } = req.body;
    const patch = {};
    if (message !== undefined) patch.message = message;
    if (time !== undefined) patch.time = time;
    if (date !== undefined) patch.date = date;
    if (recurring !== undefined) patch.recurring = recurring;
    if (channelId !== undefined) {
      if (channelId !== null && !guild.channels.cache.get(channelId)) {
        return res
          .status(422)
          .json({ error: "Channel not found in this guild" });
      }
      patch.channelId = channelId;
    }
    if (roleId !== undefined) patch.roleId = roleId;

    const alarmService = require("../../features/alarm/alarmService");
    const result = await alarmService.updateAlarm(
      client.alarmScheduler,
      alarmId,
      patch,
    );
    if (result.error) return res.status(422).json({ error: result.error });
    res.json(result.alarm);
  } catch (err) {
    logger.error(
      `PATCH /api/guilds/${req.params.id}/alarms/${req.params.alarmId}: ${err.message}`,
    );
    res.status(500).json({ error: "Failed to update alarm" });
  }
});

// DELETE /api/guilds/:id/alarms/:alarmId
router.delete("/:id/alarms/:alarmId", async (req, res) => {
  try {
    const { id, alarmId } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const alarm = await client.alarmStorage.get(alarmId);
    if (!alarm || alarm.guildId !== id) {
      return res.status(404).json({ error: "Alarm not found in this guild" });
    }

    const alarmService = require("../../features/alarm/alarmService");
    await alarmService.cancelAlarm(client.alarmScheduler, alarmId);
    res.json({ cancelled: true, alarm_id: alarmId });
  } catch (err) {
    logger.error(
      `DELETE /api/guilds/${req.params.id}/alarms/${req.params.alarmId}: ${err.message}`,
    );
    res.status(500).json({ error: "Failed to delete alarm" });
  }
});

module.exports = router;
