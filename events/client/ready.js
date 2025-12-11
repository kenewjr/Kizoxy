const { Client, ActivityType } = require("discord.js");

module.exports = async (client) => {
  console.log(`[INFO] - ${client.user.username} (${client.user.id}) is Ready!`);

  // Array of activities to cycle through
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

  // Set initial activity
  let currentActivity = 0;
  client.user.setPresence({
    activities: [activities[currentActivity]],
    status: "online", // Changed from "dnd" to "online"
  });

  // Rotate activities every 60 seconds
  setInterval(() => {
    currentActivity = (currentActivity + 1) % activities.length;
    client.user.setActivity(activities[currentActivity]);
  }, 60000); // 60 seconds

  // Optional: Update activity when bot joins/leaves a server
  client.on("guildCreate", () => {
    activities[1].name = `${client.guilds.cache.size} servers`;
    activities[2].name = `${client.users.cache.size} users`;
  });

  client.on("guildDelete", () => {
    activities[1].name = `${client.guilds.cache.size} servers`;
    activities[2].name = `${client.users.cache.size} users`;
  });
};
