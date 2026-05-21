const { ActivityType, Events } = require("discord.js");
const Logger = require("../../lib/logger");

const logger = new Logger("READY");

module.exports = async (client) => {
  logger.success(
    `${client.user.username} (${client.user.id}) is Ready!`,
  );

  const activities = [
    {
      name: `kplay <songs>`,
      type: ActivityType.Listening,
    },
    {
      name: `${client.guilds.cache.size} servers`,
      type: ActivityType.Watching,
    },
    {
      name: `${client.users.cache.size} users`,
      type: ActivityType.Watching,
    },
    {
      name: `/help for commands`,
      type: ActivityType.Playing,
    },
  ];

  let currentActivity = 0;
  client.user.setPresence({
    activities: [activities[currentActivity]],
    status: "online",
  });

  setInterval(() => {
    currentActivity = (currentActivity + 1) % activities.length;
    client.user.setActivity(activities[currentActivity]);
  }, 60000); // 60 seconds

  client.on("guildCreate", () => {
    activities[1].name = `${client.guilds.cache.size} servers`;
    activities[2].name = `${client.users.cache.size} users`;
  });

  client.on("guildDelete", () => {
    activities[1].name = `${client.guilds.cache.size} servers`;
    activities[2].name = `${client.users.cache.size} users`;
  });
};

module.exports.eventName = Events.ClientReady;
