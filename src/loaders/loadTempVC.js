const { Events } = require("discord.js");
const Logger = require("../lib/logger");
const tempVcStorage = require("../persistence/tempVcStorage");

const logger = new Logger("TempVC:Loader");

async function reconcileGuild(guild) {
  const stats = { generatorsActive: 0, recovered: 0, cleaned: 0 };

  // Generator validation: drop entries whose channel no longer exists.
  const generators = await tempVcStorage.getAllGenerators(guild.id);
  for (const gen of generators) {
    const channel =
      guild.channels?.cache?.get(gen.id) ||
      (await guild.channels?.fetch?.(gen.id).catch(() => null));
    if (!channel) {
      logger.warning(
        `Generator ${gen.id} no longer exists in ${guild.name}; removing`,
      );
      await tempVcStorage.removeGenerator(guild.id, gen.id);
    } else {
      stats.generatorsActive++;
    }
  }

  // TempVC reconciliation: drop ghosts, delete empties, re-attach survivors.
  const tempChannels = await tempVcStorage.getAllTempChannels(guild.id);
  for (const tc of tempChannels) {
    const channel =
      guild.channels?.cache?.get(tc.id) ||
      (await guild.channels?.fetch?.(tc.id).catch(() => null));

    if (!channel) {
      await tempVcStorage.removeTempChannel(guild.id, tc.id);
      stats.cleaned++;
      continue;
    }

    const humans = channel.members?.filter?.((m) => !m.user.bot)?.size ?? 0;
    if (humans === 0) {
      try {
        if (channel.deletable) {
          await channel.delete("TempVC empty on bot startup");
        }
      } catch (err) {
        logger.warning(
          `Could not delete empty TempVC ${tc.id}: ${err.message}`,
        );
      }
      await tempVcStorage.removeTempChannel(guild.id, tc.id);
      stats.cleaned++;
    } else {
      // Channel survived with members — heal the interface panel so controls
      // are available again without requiring another action to trigger a resend.
      try {
        const interfaceService = require("../features/tempvc/interfaceService");
        await interfaceService.updateInterface(guild, tc.id);
      } catch (err) {
        logger.warning(
          `Interface heal failed for ${tc.id} in ${guild.id}: ${err.message}`,
        );
      }
      stats.recovered++;
    }
  }

  return stats;
}

module.exports = (client) => {
  client.once(Events.ClientReady, async () => {
    try {
      await tempVcStorage._ensureLoaded?.();

      const totals = { generators: 0, recovered: 0, cleaned: 0 };
      for (const [, guild] of client.guilds.cache) {
        try {
          const s = await reconcileGuild(guild);
          totals.generators += s.generatorsActive;
          totals.recovered += s.recovered;
          totals.cleaned += s.cleaned;
        } catch (err) {
          logger.warning(
            `Reconcile failed for guild ${guild.id}: ${err.message}`,
          );
        }
      }

      logger.success(
        `TempVC reconciled — generators: ${totals.generators}, recovered: ${totals.recovered}, cleaned: ${totals.cleaned}`,
      );
    } catch (err) {
      logger.error(`TempVC reconciliation failed: ${err.message}`);
    }
  });

  logger.info("TempVC loader registered (reconciliation runs on ClientReady)");
};
