const Logger = require("./logger");
const logger = new Logger("WEBHOOK");

const WEBHOOK_URL = process.env.ERROR_WEBHOOK_URL || "";

// Rate limit: max 1 webhook per 10 seconds to avoid Discord rate limits
let lastSent = 0;
const RATE_LIMIT_MS = 10000;
const queue = [];
let processing = false;

/**
 * Send an error report to Discord via webhook.
 * @param {string} title - Short error title
 * @param {Error|string} error - Error object or message
 * @param {object} [extra] - Additional context fields
 */
async function sendErrorWebhook(title, error, extra = {}) {
  if (!WEBHOOK_URL) return; // Webhook not configured — silently skip

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : null;

  const embed = {
    title: `❌ ${title}`.slice(0, 256),
    color: 0xff0000,
    description: `\`\`\`\n${errorMessage.slice(0, 2000)}\n\`\`\``,
    fields: [],
    timestamp: new Date().toISOString(),
    footer: {
      text: `Kizoxy | PID: ${process.pid}`,
    },
  };

  // Add stack trace (truncated)
  if (errorStack) {
    embed.fields.push({
      name: "Stack Trace",
      value: `\`\`\`\n${errorStack.slice(0, 1000)}\n\`\`\``,
      inline: false,
    });
  }

  // Add extra context fields
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null) {
      embed.fields.push({
        name: key,
        value: String(value).slice(0, 1024),
        inline: true,
      });
    }
  }

  // Add hostname & uptime
  embed.fields.push(
    { name: "Host", value: require("os").hostname(), inline: true },
    { name: "Uptime", value: `${Math.floor(process.uptime())}s`, inline: true },
  );

  queue.push({ embeds: [embed] });
  processQueue();
}

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const now = Date.now();
    const wait = RATE_LIMIT_MS - (now - lastSent);
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }

    const payload = queue.shift();
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        logger.error(`Webhook failed: ${res.status} ${res.statusText}`);
      }
      lastSent = Date.now();
    } catch (err) {
      logger.error(`Webhook send error: ${err.message}`);
    }
  }

  processing = false;
}

module.exports = { sendErrorWebhook };
