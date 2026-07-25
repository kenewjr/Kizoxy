const { Client, GatewayIntentBits, Collection } = require("discord.js");
require("./lib/patchInteractions");
const { Connectors } = require("shoukaku");
const { Kazagumo, Plugins } = require("kazagumo");
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

client.commandStorage = require("./persistence/commandStorage");

const Nodes = client.config.NODES;
const LAVALINK_RESUME_TIMEOUT_SEC = 60;

client.manager = new Kazagumo(
  {
    defaultSearchEngine: client.config.SEARCH_ENGINE,
    plugins: [new Plugins.PlayerMoved(client)],
    send: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
  },
  new Connectors.DiscordJS(client),
  Nodes,
  {
    reconnectTries: Infinity,
    reconnectInterval: 15,
    resume: true,
    resumeTimeout: LAVALINK_RESUME_TIMEOUT_SEC,
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
  "loadTempVC",
  "loadYoutube",
  "loadTiktok",
  "loadDashboard",
];

async function bootstrap() {
  const bootStart = Date.now();

  // Load command customizations before other loaders run
  await client.commandStorage.load().catch((err) => {
    bootLogger.error(`Failed to load command customizations: ${err.message}`);
  });

  const results = await Promise.all(
    LOADERS.map((mod) => runLoader(mod, require(`./loaders/${mod}`))),
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

let musicResumeLoaded = false;
async function tryTriggerMusicResume() {
  if (musicResumeLoaded) return;
  if (!client.isReady()) return;
  const nodes = client.manager?.shoukaku?.nodes;
  const hasConnectedNode =
    nodes && [...nodes.values()].some((n) => n.state === 1);
  if (!hasConnectedNode) return;

  musicResumeLoaded = true;
  runLoader("loadMusicResume", require("./loaders/loadMusicResume")).catch(
    () => {},
  );
}

client.once("ready", () => {
  tryTriggerMusicResume().catch(() => {});
});

client.manager.shoukaku.on("ready", (name, lavalinkResume, libraryResume) => {
  const resumed = !!(lavalinkResume || libraryResume);
  bootLogger.info(
    resumed
      ? `Lavalink node "${name}" session RESUMED — active players preserved.`
      : `Lavalink node "${name}" connected (fresh session).`,
  );
  tryTriggerMusicResume().catch(() => {});
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
  const musicSessionStorage = require("./persistence/musicSessionStorage");
  async function snapshotActivePlayers() {
    if (!client.manager?.players) return;
    const snapshots = [];
    for (const [guildId, player] of client.manager.players) {
      try {
        if (!player.queue?.current) continue;
        snapshots.push(
          musicSessionStorage.saveSession(guildId, {
            guildId,
            voiceChannelId: player.voiceId,
            textChannelId: player.textId,
            currentTrack: {
              uri: player.queue.current.uri,
              title: player.queue.current.title,
              requesterId: player.queue.current.requester?.id,
            },
            positionMs: player.position ?? 0,
            queue: [...player.queue].map((t) => ({
              uri: t.uri,
              title: t.title,
              requesterId: t.requester?.id,
            })),
            volume: player.volume,
            loopMode: player.loop,
            savedAt: Date.now(),
          }),
        );
      } catch (err) {
        console.error(`Failed to snapshot player for guild ${guildId}:`, err);
      }
    }
    await Promise.allSettled(snapshots);
  }
  await snapshotActivePlayers();

  const storages = [
    client.alarmStorage,
    client.levelStorage,
    client.fixembedStorage,
    client.youtubeStorage,
    client.youtubeStateStorage,
    client.tiktokStorage,
    client.tiktokStateStorage,
    client.commandStorage,
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
  if (client.youtubeScheduler) {
    client.youtubeScheduler.stop();
  }
  if (client.tiktokScheduler) {
    client.tiktokScheduler.stop();
  }
  try {
    const { clearAlarmIntervals } = require("./loaders/loadAlarm");
    if (typeof clearAlarmIntervals === "function") clearAlarmIntervals();
  } catch (err) {
    console.error("Failed to clear alarm intervals:", err);
  }
  if (process.env.NODE_ENV !== "test") {
    process.exit(0);
  }
}
process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.once("SIGINT", () => gracefulShutdown("SIGINT"));

if (require.main === module) {
  bootstrap().catch((err) => {
    bootLogger.error(`Bootstrap failed: ${err.message}`);
    sendErrorWebhook(
      "Bootstrap Failure",
      err instanceof Error ? err : new Error(String(err)),
    );
  });

  client.login(client.token);
}

module.exports = {
  client,
  gracefulShutdown,
};
