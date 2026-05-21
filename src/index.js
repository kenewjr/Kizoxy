const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { Connectors } = require("shoukaku");
const { Kazagumo, Plugins } = require("kazagumo");
const KazagumoSpotify = require("kazagumo-spotify");
const Logger = require("./lib/logger");
const bootLogger = new Logger("BOOT");

const client = new Client({
  shards: "auto",
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  allowedMentions: { parse: ["users", "roles"] },
});

client.config = require("./config/config");
client.prefix = client.config.PREFIX;
client.owner = client.config.OWNER_ID;
client.color = client.config.EMBED_COLOR;
if (!client.token) client.token = client.config.TOKEN;
client.commands = new Collection();
client.buttons = new Collection();
client.aliases = new Collection();
client.prefixCommands = new Map();

const LogStorage = require("./persistence/logStorage");
client.logStorage = new LogStorage();

const Nodes = client.config.NODES;

client.manager = new Kazagumo(
  {
    defaultSearchEngine: client.config.SEARCH_ENGINE, // 'youtube' | 'soundcloud' | 'youtube_music'
    plugins: [
      new Plugins.PlayerMoved(client),
      new KazagumoSpotify({
        clientId: client.config.spotifyClientID,
        clientSecret: client.config.spotifySecret,
        playlistPageLimit: 100, // Spotify API max page size (100 tracks)
        albumPageLimit: 100, // Spotify API max page size (50 tracks)
        searchLimit: 10, // optional ( track search limit. Max 50 )
        searchMarket: "US", // optional || default: US ( Enter the country you live in. [ Can only be of 2 letters. For eg: US, IN, EN ] )//
        lavalinkPluginTries: 0,
      }),
    ],
    send: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
  },
  new Connectors.DiscordJS(client),
  Nodes,
  {
    reconnectTries: Infinity, // keep trying forever
    reconnectInterval: 15, // 15 second interval between attempts
  },
);

async function runLoader(name, loaderFn) {
  const started = Date.now();
  try {
    await loaderFn(client);
    const elapsed = Date.now() - started;
    bootLogger.info(`Loader \"${name}\" ok (${elapsed}ms)`);
    return { name, ok: true, ms: elapsed };
  } catch (error) {
    const elapsed = Date.now() - started;
    bootLogger.error(
      `Loader \"${name}\" failed in ${elapsed}ms: ${error.message}`,
    );
    bootLogger.error(error.stack || String(error));
    return { name, ok: false, ms: elapsed, error };
  }
}

const LOADERS = [
  "loadCommand",
  "loadPrefix",
  "loadButtons",
  "loadEvent",
  "loadPlayer",
  "loadTrack",
  "loadAlarm",
];

async function bootstrap() {
  const bootStart = Date.now();

  const results = await Promise.all(
    LOADERS.map((mod) => runLoader(mod, require(`./loaders/${mod}`))),
  );

  await runLoader("loadJikanSchedule", (c) =>
    require("./integrations/jikan/loadJikanSchedule")(c),
  );

  require("./features/lyrics/romajiConverter")
    .preInitialize()
    .catch(() => {});

  const failed = results.filter((r) => !r.ok).map((r) => r.name);
  const totalMs = Date.now() - bootStart;
  if (failed.length === 0) {
    bootLogger.success(`All ${results.length} loaders ready in ${totalMs}ms`);
  } else {
    bootLogger.warning(
      `${failed.length}/${results.length} loaders failed (${failed.join(", ")}); booting in degraded mode (${totalMs}ms)`,
    );
  }
}

const { sendErrorWebhook } = require("./lib/webhookReporter");

process.on("uncaughtException", (error) => {
  console.error("[FATAL] Uncaught Exception:", error);
  sendErrorWebhook("Uncaught Exception", error);
});

function describeRejection(reason) {
  if (!(reason instanceof Error)) return String(reason);
  const lines = [`${reason.name}: ${reason.message}`];
  if (reason.code) lines.push(`  code=${reason.code}`);
  if (reason.errno) lines.push(`  errno=${reason.errno}`);
  if (reason.library) lines.push(`  library=${reason.library}`);
  if (reason.reason) lines.push(`  reason=${reason.reason}`);
  let cause = reason.cause;
  let depth = 0;
  while (cause && depth < 5) {
    lines.push(
      `  caused by: ${cause.name || "Error"}: ${cause.message || cause}` +
        (cause.code ? ` (code=${cause.code})` : ""),
    );
    if (cause.stack) {
      const firstFrame = String(cause.stack).split("\n")[1];
      if (firstFrame) lines.push(`    at ${firstFrame.trim()}`);
    }
    cause = cause.cause;
    depth++;
  }
  if (reason.stack) lines.push(reason.stack);
  return lines.join("\n");
}

process.on("unhandledRejection", (reason, _promise) => {
  console.error("[FATAL] Unhandled Rejection:\n" + describeRejection(reason));
  sendErrorWebhook(
    "Unhandled Rejection",
    reason instanceof Error ? reason : new Error(String(reason)),
  );
});

client.on("error", (error) => {
  console.error("[DISCORD] Client Error:", error);
  sendErrorWebhook("Discord Client Error", error);
});

client.on("warn", (message) => {
  console.warn("[DISCORD] Warning:", message);
  sendErrorWebhook("Discord Warning", message);
});

client.on("shardError", (error, shardId) => {
  console.error(`[DISCORD] Shard ${shardId} Error:`, error);
  sendErrorWebhook("Shard Error", error, { "Shard ID": shardId });
});

client.manager.shoukaku.on("error", (name, error) => {
  console.error(`[LAVALINK] Node "${name}" Error:`, error);
  sendErrorWebhook(
    "Lavalink Node Error",
    error instanceof Error ? error : new Error(String(error)),
    { Node: name },
  );
});

client.manager.shoukaku.on("ready", (name) => {
  bootLogger.success(`Lavalink node "${name}" connected`);
});
client.manager.shoukaku.on("disconnect", (name) => {
  bootLogger.warning(`Lavalink node "${name}" disconnected`);
});
client.manager.shoukaku.on("close", (name, code) => {
  bootLogger.warning(
    `Lavalink node "${name}" connection closed (code=${code}); shoukaku will retry per reconnectInterval`,
  );
});

async function gracefulShutdown(signal) {
  console.warn(`[SHUTDOWN] Received ${signal}, flushing storage...`);
  const storages = [
    client.alarmStorage,
    client.levelStorage,
    client.fixembedStorage,
  ];
  await Promise.all(
    storages
      .filter((s) => s && typeof s.flush === "function")
      .map((s) =>
        s.flush().catch((err) => console.error("Flush failed:", err)),
      ),
  );
  if (client.alarmScheduler) {
    for (const job of client.alarmScheduler.jobs.values()) {
      if (job && typeof job.clear === "function") job.clear();
      else clearTimeout(job);
    }
  }
  try {
    const { clearAlarmIntervals } = require("./loaders/loadAlarm");
    if (typeof clearAlarmIntervals === "function") clearAlarmIntervals();
  } catch (err) {
    console.error("Failed to clear alarm intervals:", err);
  }
  process.exit(0);
}
process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.once("SIGINT", () => gracefulShutdown("SIGINT"));

bootstrap().catch((err) => {
  bootLogger.error(`Bootstrap failed: ${err.message}`);
  sendErrorWebhook(
    "Bootstrap Failure",
    err instanceof Error ? err : new Error(String(err)),
  );
});

client.login(client.token);
