const djs = require("discord.js");
const { EPHEMERAL_AUTO_DELETE_MS } = require("../config/constants");
const { stats } = require("./ephemeralStats");
const Logger = require("./logger");

const logger = new Logger("INTERACTION-PATCH");

function patchInteraction(prototype) {
  const originalReply = prototype.reply;
  const originalFollowUp = prototype.followUp;
  const originalEditReply = prototype.editReply;

  const scheduleDeletion = (interaction, response, payload) => {
    if (interaction._kizoxyAutoDeleteScheduled) {
      return;
    }

    if (!interaction._ephemeralTimeouts) {
      interaction._ephemeralTimeouts = new Map();
    }

    const isEphemeral =
      payload &&
      (payload.ephemeral === true ||
        (payload.flags && (payload.flags & 64) === 64));
    const hasComponents =
      payload && payload.components && payload.components.length > 0;

    const msgId = response?.id || "original";

    // Clear any existing timeout for this message
    if (interaction._ephemeralTimeouts.has(msgId)) {
      clearTimeout(interaction._ephemeralTimeouts.get(msgId));
      interaction._ephemeralTimeouts.delete(msgId);
    }

    if (isEphemeral && !hasComponents) {
      interaction._kizoxyAutoDeleteScheduled = true;
      stats.scheduled++;

      const ttl =
        payload && typeof payload.ttl === "number"
          ? payload.ttl
          : EPHEMERAL_AUTO_DELETE_MS;

      const timeout = setTimeout(async () => {
        try {
          if (response && response.id) {
            await interaction.deleteReply(response.id);
          } else {
            await interaction.deleteReply();
          }
        } catch (err) {
          if (err.code === 10008) {
            logger.debug(
              `Auto-delete skipped: Message already deleted (code 10008) for interaction ${interaction.id}`,
            );
            stats.swallowed++;
          } else {
            logger.error(
              `Error deleting reply on interaction ${interaction.id}: ${err.message}`,
            );
          }
        } finally {
          stats.fired++;
          interaction._ephemeralTimeouts.delete(msgId);
        }
      }, ttl);
      interaction._ephemeralTimeouts.set(msgId, timeout);
    }
  };

  prototype.reply = async function (options) {
    const payload =
      typeof options === "string" ? { content: options } : { ...options };

    const isEphemeral =
      payload.ephemeral === true ||
      (payload.flags && (payload.flags & 64) === 64);
    const hasComponents = payload.components && payload.components.length > 0;

    if (isEphemeral && !hasComponents) {
      payload.fetchReply = true;
    }

    const response = await originalReply.call(this, payload);
    scheduleDeletion(this, response, payload);
    return response;
  };

  prototype.followUp = async function (options) {
    const payload =
      typeof options === "string" ? { content: options } : { ...options };
    const response = await originalFollowUp.call(this, payload);
    scheduleDeletion(this, response, payload);
    return response;
  };

  prototype.editReply = async function (options) {
    const payload =
      typeof options === "string" ? { content: options } : { ...options };
    const response = await originalEditReply.call(this, payload);
    const isEphemeral =
      payload.ephemeral === true ||
      (this.deferred && this.ephemeral) ||
      this.ephemeral;
    const hasComponents = payload.components && payload.components.length > 0;
    if (isEphemeral && !hasComponents) {
      scheduleDeletion(this, response, payload);
    }
    return response;
  };
}

const targets = [
  djs.CommandInteraction.prototype,
  djs.MessageComponentInteraction.prototype,
  djs.ModalSubmitInteraction.prototype,
];

for (const target of targets) {
  if (target) {
    patchInteraction(target);
  }
}

module.exports = { patchInteraction };
