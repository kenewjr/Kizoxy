const { ActivityType, Events } = require("discord.js");
const Logger = require("../../lib/logger");

const logger = new Logger("READY");

let paused = false;
function pausePresenceRotation() {
  paused = true;
}
function resumePresenceRotation() {
  paused = false;
}
function isRotationPaused() {
  return paused;
}

function getCustomActivities() {
  const fs = require("fs");
  const path = require("path");
  const overridesPath = path.join(
    __dirname,
    "../../../data/config_overrides.json",
  );
  if (fs.existsSync(overridesPath)) {
    try {
      const overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
      if (
        overrides.custom_activities &&
        Array.isArray(overrides.custom_activities) &&
        overrides.custom_activities.length > 0
      ) {
        const { ActivityType: AType } = require("discord.js");
        const typeMap = {
          playing: AType.Playing,
          listening: AType.Listening,
          watching: AType.Watching,
          competing: AType.Competing,
        };
        return overrides.custom_activities.map((act) => ({
          name: act.text,
          type: typeMap[act.type] ?? AType.Playing,
        }));
      }
    } catch (_) {}
  }
  return null;
}

module.exports = async (client) => {
  logger.success(`${client.user.username} (${client.user.id}) is Ready!`);

  const fs = require("fs");
  const path = require("path");
  const overridesPath = path.join(
    __dirname,
    "../../../data/config_overrides.json",
  );
  if (fs.existsSync(overridesPath)) {
    try {
      const overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
      if (overrides.rotation_paused !== undefined) {
        paused = overrides.rotation_paused;
      }
    } catch (_) {}
  }

  let currentActivity = 0;

  const getActivitiesList = () => {
    const custom = getCustomActivities();
    if (custom) return custom;
    return [
      {
        name: `kplay <songs>`,
        type: ActivityType.Listening,
      },
      {
        name: `{guilds} servers`,
        type: ActivityType.Watching,
      },
      {
        name: `{users} users`,
        type: ActivityType.Watching,
      },
      {
        name: `/help for commands`,
        type: ActivityType.Playing,
      },
    ];
  };

  const updatePresence = () => {
    const list = getActivitiesList();
    if (list.length === 0) return;
    currentActivity = currentActivity % list.length;
    const act = list[currentActivity];
    const formattedName = act.name
      .replace(/\{guilds\}/gi, client.guilds.cache.size)
      .replace(
        /\{users\}/gi,
        client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
      )
      .replace(
        /\{members\}/gi,
        client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
      )
      .replace(/\{prefix\}/gi, require("../../config/config").PREFIX);
    client.user.setActivity({
      name: formattedName,
      type: act.type,
    });
  };

  updatePresence();

  setInterval(() => {
    if (paused) return;
    currentActivity = (currentActivity + 1) % getActivitiesList().length;
    updatePresence();
  }, 60000); // 60 seconds
};

module.exports.eventName = Events.ClientReady;
module.exports.pausePresenceRotation = pausePresenceRotation;
module.exports.resumePresenceRotation = resumePresenceRotation;
module.exports.isRotationPaused = isRotationPaused;
