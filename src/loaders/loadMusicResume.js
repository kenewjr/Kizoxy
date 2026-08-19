const musicSessionStorage = require("../persistence/musicSessionStorage");
const Logger = require("../lib/logger");
const logger = new Logger("MUSIC-RESUME");

module.exports = async (client) => {
  try {
    const sessions = await musicSessionStorage.getAllSessions();
    if (sessions.length === 0) return;

    logger.info(`Found ${sessions.length} music session(s) to restore.`);

    for (const session of sessions) {
      try {
        const guild = client.guilds.cache.get(session.guildId);
        const voiceChannel = guild?.channels.cache.get(session.voiceChannelId);
        const textChannel = guild?.channels.cache.get(session.textChannelId);

        if (!guild || !voiceChannel || !textChannel) {
          logger.warning(
            `Skipping resume for guild ${session.guildId} — guild/channel no longer exists.`,
          );
          await musicSessionStorage.deleteSession(session.guildId);
          continue;
        }

        const player = await client.manager.createPlayer({
          guildId: session.guildId,
          textId: session.textChannelId,
          voiceId: session.voiceChannelId,
          shardId: guild.shardId ?? 0,
        });

        const resolvedCurrent = await client.manager.search(
          session.currentTrack.uri,
          {
            requester: {
              id: session.currentTrack.requesterId,
              toString: () => `<@${session.currentTrack.requesterId}>`,
            },
          },
        );

        if (resolvedCurrent?.tracks?.[0]) {
          player.queue.add(resolvedCurrent.tracks[0]);
        } else {
          logger.warning(
            `Current track ${session.currentTrack.title} (${session.currentTrack.uri}) not available.`,
          );
        }

        for (const queuedTrack of session.queue) {
          const resolved = await client.manager.search(queuedTrack.uri, {
            requester: {
              id: queuedTrack.requesterId,
              toString: () => `<@${queuedTrack.requesterId}>`,
            },
          });
          if (resolved?.tracks?.[0]) {
            player.queue.add(resolved.tracks[0]);
          } else {
            logger.warning(
              `Queued track ${queuedTrack.title} (${queuedTrack.uri}) not available, skipping.`,
            );
          }
        }

        if (!player.queue.current && player.queue.length === 0) {
          logger.warning(
            `No tracks resolved for guild ${session.guildId}, skipping player start.`,
          );
          await musicSessionStorage.deleteSession(session.guildId);
          await player.destroy();
          continue;
        }

        player.setVolume(session.volume ?? 100);
        if (session.loopMode) {
          player.setLoop(session.loopMode);
        }

        if (session.positionMs > 0) {
          const seekOnStart = (p) => {
            if (p.guildId === session.guildId) {
              client.manager.off("playerStart", seekOnStart);
              p.seek(session.positionMs).catch((seekErr) => {
                logger.error(
                  `Failed to seek player for guild ${session.guildId}: ${seekErr.message}`,
                );
              });
            }
          };
          client.manager.on("playerStart", seekOnStart);
          setTimeout(() => {
            client.manager.off("playerStart", seekOnStart);
          }, 15000).unref?.();
        }

        await player.play();

        await textChannel
          .send({
            content: `▶️ Resumed **${
              player.queue.current?.title || session.currentTrack.title
            }** after a restart (picking up where it left off).`,
          })
          .catch(() => {});

        await musicSessionStorage.deleteSession(session.guildId);
        logger.success(`Restored music session for guild ${session.guildId}.`);
      } catch (err) {
        logger.error(
          `Failed to restore music session for guild ${session.guildId}: ${err.message}`,
        );
        await musicSessionStorage
          .deleteSession(session.guildId)
          .catch(() => {});
        const player = client.manager.players.get(session.guildId);
        if (player) {
          await player.destroy().catch(() => {});
        }
      }
    }
  } catch (error) {
    logger.error(`Error in music resume loader: ${error.message}`);
  }
};
