const Embeds = require("../../lib/embeds");
const Logger = require("../../lib/logger");
const LevelStorage = require("../../persistence/levelStorage");
const levelSettingsStorage = require("../../persistence/levelSettingsStorage");

const logger = new Logger("LEVEL");

const COOLDOWN_AUTO_DELETE_MS = 15_000;
const DEFAULT_COOLDOWN_MS = 15_000;

const cooldowns = new Map();

async function handleMessageXp(client, message) {
  if (!client.levelStorage) {
    client.levelStorage = new LevelStorage();
  }

  const settings = levelSettingsStorage.getSettings(message.guild.id);
  if (settings.xp_enabled === false) return;

  const cooldownMs =
    (Number(settings.cooldown_seconds) || DEFAULT_COOLDOWN_MS / 1000) * 1000;
  const xpMin = Number.isFinite(settings.xp_min) ? settings.xp_min : 10;
  const xpMax = Number.isFinite(settings.xp_max) ? settings.xp_max : 20;

  // Cooldown is tracked per guild+user so different guilds don't share timers.
  const cooldownKey = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const last = cooldowns.get(cooldownKey);
  if (last !== undefined && now < last + cooldownMs) return;

  cooldowns.set(cooldownKey, now);
  setTimeout(() => cooldowns.delete(cooldownKey), cooldownMs);

  const xp = Math.floor(Math.random() * (xpMax - xpMin + 1)) + xpMin;

  try {
    const result = await client.levelStorage.addXp(
      message.author.id,
      message.guild.id,
      xp,
    );

    if (!result.leveledUp) return;

    const embed = Embeds.brand(client, {
      description: `🎉 **Congratulations ${message.author}!** You have leveled up to **Level ${result.level}**!`,
    });

    // Announce in the configured channel if set and resolvable, else in-place.
    let target = message.channel;
    if (settings.level_up_channel_id) {
      const configured = message.guild.channels.cache.get(
        settings.level_up_channel_id,
      );
      if (configured) target = configured;
    }

    const sent = await target.send({ embeds: [embed] });
    setTimeout(() => {
      sent
        .delete()
        .catch((err) =>
          logger.warning(`Failed to delete level-up message: ${err.message}`),
        );
    }, COOLDOWN_AUTO_DELETE_MS);
  } catch (error) {
    logger.error(`Error adding text XP: ${error.message}`);
  }
}

module.exports = {
  handleMessageXp,
};
