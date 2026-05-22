const Embeds = require("../../lib/embeds");
const Logger = require("../../lib/logger");
const LevelStorage = require("../../persistence/levelStorage");

const logger = new Logger("LEVEL");

const COOLDOWN_MS = 15_000;
const COOLDOWN_AUTO_DELETE_MS = 15_000;
const XP_MIN = 10;
const XP_MAX = 20;

const cooldowns = new Map();

async function handleMessageXp(client, message) {
  if (!client.levelStorage) {
    client.levelStorage = new LevelStorage();
  }

  const now = Date.now();
  const last = cooldowns.get(message.author.id);
  if (last !== undefined && now < last + COOLDOWN_MS) return;

  cooldowns.set(message.author.id, now);
  setTimeout(() => cooldowns.delete(message.author.id), COOLDOWN_MS);

  const xp = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;

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

    const sent = await message.channel.send({ embeds: [embed] });
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
