const Logger = require("./logger");
const logger = new Logger("WEBHOOK");

const WEBHOOK_URL = process.env.ERROR_WEBHOOK_URL || "";

// Rate limit: max 1 webhook per 10 seconds to avoid Discord rate limits
let lastSent = 0;
const RATE_LIMIT_MS = 10000;
const SEND_TIMEOUT_MS = 10000;
const queue = [];
let processing = false;

// Validate URL once at boot — avoids repeated DNS/TLS failures on a typo
const VALID_WEBHOOK =
  /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/.test(
    WEBHOOK_URL,
  );
if (WEBHOOK_URL && !VALID_WEBHOOK) {
  logger.warn(
    "ERROR_WEBHOOK_URL is set but does not look like a Discord webhook URL — ignoring.",
  );
}

// Format an error including its `cause` chain (TLS errors usually live in cause)
function formatError(err) {
  if (!(err instanceof Error)) return String(err);
  const parts = [`${err.name}: ${err.message}`];
  if (err.code) parts.push(`code=${err.code}`);
  if (err.errno) parts.push(`errno=${err.errno}`);
  let cause = err.cause;
  let depth = 0;
  while (cause && depth < 5) {
    parts.push(
      `  caused by: ${cause.name || "Error"}: ${cause.message || cause}` +
        (cause.code ? ` (code=${cause.code})` : ""),
    );
    cause = cause.cause;
    depth++;
  }
  return parts.join("\n");
}

async function sendErrorWebhook(title, error, extra = {}) {
  if (!WEBHOOK_URL || !VALID_WEBHOOK) return; // not configured — silently skip

  const errorStack = error instanceof Error ? error.stack : null;

  const embed = {
    title: `❌ ${title}`.slice(0, 256),
    color: 0xff0000,
    description: `\`\`\`\n${formatError(error).slice(0, 2000)}\n\`\`\``,
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
  // Defensive: never let queue processing throw an unhandled rejection
  processQueue().catch((err) => {
    logger.error(`Queue processor crashed: ${formatError(err)}`);
    processing = false;
  });
}

// Avoid spamming "errored" if the webhook endpoint is down for a long time.
let consecutiveFailures = 0;
const FAILURE_BACKOFF_THRESHOLD = 5;

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        logger.error(`Webhook failed: ${res.status} ${res.statusText}`);
        consecutiveFailures++;
      } else {
        consecutiveFailures = 0;
      }
      lastSent = Date.now();
    } catch (err) {
      // Surface the cause chain — `fetch failed` alone is useless
      logger.error(`Webhook send error: ${formatError(err)}`);
      consecutiveFailures++;
      lastSent = Date.now();
    } finally {
      clearTimeout(timer);
    }

    // If the endpoint is consistently failing, drop remaining queued
    // payloads rather than blocking the process for minutes.
    if (consecutiveFailures >= FAILURE_BACKOFF_THRESHOLD) {
      logger.warn(
        `Dropping ${queue.length} queued webhook payload(s) after ${consecutiveFailures} consecutive failures.`,
      );
      queue.length = 0;
      break;
    }
  }

  processing = false;
}

module.exports = { sendErrorWebhook };
