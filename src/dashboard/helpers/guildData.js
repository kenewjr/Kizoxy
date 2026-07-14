const { ChannelType, PermissionFlagsBits } = require("discord.js");
const youtubeStorage = require("../../persistence/youtubeStorage");
const tiktokStorage = require("../../persistence/tiktokStorage");
const fixembedStorage = require("../../persistence/fixembedStorage");
const tempVcStorage = require("../../persistence/tempVcStorage");
const config = require("../../config/config");

let _version = null;
function getVersion() {
  if (!_version) {
    try {
      _version = require("../../../package.json").version;
    } catch {
      _version = "unknown";
    }
  }
  return _version;
}

const SHOUKAKU_STATE = {
  CONNECTING: 0,
  CONNECTED: 1,
  DISCONNECTED: 2,
  RECONNECTING: 3,
};

function lavalinkStatus(client) {
  try {
    const shoukaku = client.manager?.shoukaku || client.kazagumo?.shoukaku;
    const node = shoukaku?.nodes?.values?.().next?.().value;
    if (!node) return "disconnected";
    if (node.state === SHOUKAKU_STATE.CONNECTED) return "connected";
    if (node.state === SHOUKAKU_STATE.CONNECTING) return "connecting";
    if (node.state === SHOUKAKU_STATE.RECONNECTING) return "reconnecting";
    return "disconnected";
  } catch {
    return "disconnected";
  }
}

function nextLevelXp(currentLevel, _currentXp) {
  return 5 * Math.pow(currentLevel, 2) + 50 * currentLevel + 100;
}

async function getBotMeta(client) {
  const mem = process.memoryUsage();
  let userCount = 0;
  for (const g of client.guilds.cache.values()) userCount += g.memberCount;

  const clientReady = require("../../events/client/clientReady");
  const presence = client.user?.presence;

  const fs = require("fs");
  const path = require("path");
  const overridesPath = path.join(
    __dirname,
    "../../../data/config_overrides.json",
  );
  let custom_activities = [];
  if (fs.existsSync(overridesPath)) {
    try {
      const overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
      if (overrides.custom_activities) {
        custom_activities = overrides.custom_activities;
      }
    } catch (_) {}
  }

  return {
    bot_name: client.user?.username ?? "Kizoxy",
    bot_tag: client.user?.tag ?? "Kizoxy#0000",
    bot_avatar_url: client.user?.displayAvatarURL?.({ size: 128 }) ?? null,
    bot_id: client.user?.id ?? null,
    bot_color: config.BOT_COLOR,
    status: client.ws.status === 0 ? "online" : "offline",
    lavalink_status: lavalinkStatus(client),
    uptime_ms: Math.round(process.uptime() * 1000),
    memory_rss_mb: Math.round(mem.rss / 1024 / 1024),
    memory_heap_mb: Math.round(mem.heapUsed / 1024 / 1024),
    version: getVersion(),
    guild_count: client.guilds.cache.size,
    user_count: userCount,
    rotation_paused: clientReady.isRotationPaused(),
    presence_status: presence?.status ?? "online",
    presence_activity: presence?.activities?.[0]?.name ?? null,
    presence_activity_type: presence?.activities?.[0]?.type ?? 0,
    custom_activities,
  };
}

async function getGuildList(client) {
  const guilds = [...client.guilds.cache.values()];
  const results = await Promise.allSettled(
    guilds.map(async (g) => {
      const [ytSubs, ttSubs] = await Promise.allSettled([
        youtubeStorage.listSubscriptions(g.id),
        tiktokStorage.listSubscriptions(g.id),
      ]);
      const tempvc = await tempVcStorage._guild(g.id).catch(() => null);

      return {
        id: g.id,
        name: g.name,
        icon: g.iconURL?.({ size: 64 }) ?? null,
        memberCount: g.memberCount,
        ownerId: g.ownerId,
        feature_counts: {
          youtube: ytSubs.status === "fulfilled" ? ytSubs.value.length : 0,
          tiktok: ttSubs.status === "fulfilled" ? ttSubs.value.length : 0,
          alarms: 0, // ponytail: per-guild alarm count; upgrade when alarmScheduler exposes guild filter
          tempvc: tempvc?.generators
            ? Object.keys(tempvc.generators).length
            : 0,
        },
      };
    }),
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value)
    .sort((a, b) => b.memberCount - a.memberCount);
}

async function getGuildDetail(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;

  // Ensure members are fetched/cached
  if (
    guild.members &&
    guild.members.cache &&
    typeof guild.members.fetch === "function"
  ) {
    if (guild.members.cache.size < (guild.memberCount || 0)) {
      await guild.members.fetch().catch(() => {});
    }
  }

  const sendableTypes = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.AnnouncementThread,
  ];
  const channels = guild.channels?.cache
    ? [...guild.channels.cache.values()]
        .filter((c) => {
          try {
            if (!sendableTypes.includes(c.type)) return false;
            if (c.archived) return false;
            const perms = c.permissionsFor(client.user);
            return (
              perms &&
              perms.has(PermissionFlagsBits.ViewChannel) &&
              perms.has(PermissionFlagsBits.SendMessages)
            );
          } catch (_) {
            return false;
          }
        })
        .map((c) => {
          const perms = c.permissionsFor(client.user);
          return {
            id: c.id,
            name: c.name,
            type: c.type,
            parentName: c.parent ? c.parent.name : null,
            mentionEveryoneAllowed: !!(
              perms && perms.has(PermissionFlagsBits.MentionEveryone)
            ),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const roles = guild.roles?.cache
    ? [...guild.roles.cache.values()]
        .filter((r) => r.name !== "@everyone")
        .map((r) => ({
          id: r.id,
          name: r.name,
          color: r.hexColor,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const members = guild.members?.cache
    ? [...guild.members.cache.values()]
        .map((m) => ({
          id: m.id,
          name: m.displayName,
          tag: m.user?.tag || "",
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  if (!client.levelStorage) {
    const LevelStorage = require("../../persistence/levelStorage");
    client.levelStorage = new LevelStorage();
  }

  const [fixembed, tempvc, leaderboard] = await Promise.allSettled([
    Promise.resolve(fixembedStorage.getSettings(guildId)),
    tempVcStorage._guild(guildId),
    client.levelStorage.getLeaderboard(guildId),
  ]);

  const tempvcData = tempvc.status === "fulfilled" ? tempvc.value : null;

  // Collect alarm jobs for this guild.
  const alarms = [];
  if (client.alarmScheduler?.jobs) {
    for (const [, job] of client.alarmScheduler.jobs) {
      if (job?.guildId === guildId) alarms.push(job);
    }
  }

  const lb =
    leaderboard.status === "fulfilled" ? (leaderboard.value ?? []) : [];

  return {
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL?.({ size: 128 }) ?? null,
    memberCount: guild.memberCount,
    channelCount: guild.channels?.cache?.size ?? 0,
    roleCount: guild.roles?.cache?.size ?? 0,
    ownerId: guild.ownerId,
    joinedAt: guild.joinedAt?.toISOString?.() ?? null,
    fixembed: fixembed.status === "fulfilled" ? fixembed.value : null,
    tempvc: {
      generators: tempvcData?.generators
        ? Object.values(tempvcData.generators)
        : [],
      active_count: tempvcData?.tempChannels
        ? Object.keys(tempvcData.tempChannels).length
        : 0,
      active_channels: tempvcData?.tempChannels
        ? Object.values(tempvcData.tempChannels).map((ch) => {
            const channelObj = guild.channels?.cache?.get(ch.id);
            return {
              id: ch.id,
              ownerId: ch.ownerId,
              createdAt: ch.createdAt,
              memberCount: channelObj ? (channelObj.members?.size ?? "—") : "—",
            };
          })
        : [],
    },
    alarms,
    level_top10: lb.slice(0, 10),
    channels,
    roles,
    members,
  };
}

module.exports = { getBotMeta, getGuildList, getGuildDetail, nextLevelXp };
