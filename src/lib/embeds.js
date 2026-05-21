const { EmbedBuilder } = require("discord.js");

// ──────────────────────────────────────────────────────────────────────────
// Standardized color palette (Discord brand-aligned).
// Always reference COLORS by semantic name in commands/buttons; never use
// raw hex literals so the palette stays consistent across the bot.
// ──────────────────────────────────────────────────────────────────────────
const COLORS = Object.freeze({
  INFO: 0x5865f2, // Discord blurple
  SUCCESS: 0x57f287, // Discord green
  ERROR: 0xed4245, // Discord red
  WARNING: 0xfee75c, // Discord yellow
  MUSIC: 0x9b59b6, // Purple (matches lyrics)
  LOFI: 0xff7f50, // Coral
});

// Discord embed limits we enforce defensively.
const LIMITS = Object.freeze({
  TITLE: 256,
  DESCRIPTION: 4096, // Discord hard limit; user requested soft cap of 2048
  DESCRIPTION_SOFT: 2048,
  FOOTER_TEXT: 2048,
  FIELD_NAME: 256,
  FIELD_VALUE: 1024,
  FIELDS: 25, // Discord hard cap
  FIELDS_RECOMMENDED: 9, // user-requested readability cap
});

function truncate(str, max, suffix = "…") {
  if (typeof str !== "string") return str;
  if (str.length <= max) return str;
  return str.slice(0, max - suffix.length) + suffix;
}

function truncateDescription(text, options = {}) {
  if (typeof text !== "string") return text;
  const max = options.softCap ? LIMITS.DESCRIPTION_SOFT : LIMITS.DESCRIPTION;
  if (text.length <= max) return text;

  const moreUrl = options.readMoreUrl;
  const suffix = moreUrl
    ? `…\n[Lihat lebih lanjut](${moreUrl})`
    : "…\n*(dipotong)*";
  return text.slice(0, max - suffix.length) + suffix;
}

// ──────────────────────────────────────────────────────────────────────────
// Core builder: enforces footer/timestamp/limits on every embed we emit.
// `client` is optional; passing it auto-applies the bot name/avatar to footer.
// ──────────────────────────────────────────────────────────────────────────
function baseEmbed(client, color) {
  const embed = new EmbedBuilder().setColor(color).setTimestamp();

  if (client?.user) {
    embed.setFooter({
      text: client.user.username,
      iconURL: client.user.displayAvatarURL(),
    });
  }
  return embed;
}

function applyOptions(embed, options = {}) {
  if (options.title) embed.setTitle(truncate(options.title, LIMITS.TITLE));
  if (options.description) {
    embed.setDescription(
      truncateDescription(options.description, {
        softCap: options.softCap !== false,
        readMoreUrl: options.readMoreUrl,
      }),
    );
  }
  if (options.url) embed.setURL(options.url);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  if (options.author) embed.setAuthor(options.author);
  if (options.fields && Array.isArray(options.fields)) {
    const safeFields = options.fields
      .slice(0, LIMITS.FIELDS_RECOMMENDED)
      .map((f) => ({
        name: truncate(f.name ?? "—", LIMITS.FIELD_NAME),
        value: truncate(f.value ?? "—", LIMITS.FIELD_VALUE),
        inline: !!f.inline,
      }));
    embed.addFields(safeFields);
  }
  if (options.footerText) {
    embed.setFooter({
      text: truncate(options.footerText, LIMITS.FOOTER_TEXT),
      iconURL: options.footerIcon,
    });
  }
  return embed;
}

// ──────────────────────────────────────────────────────────────────────────
// Public factory methods — semantic shorthand for the four core states.
// Each returns a configured EmbedBuilder ready to send.
// ──────────────────────────────────────────────────────────────────────────
const Embeds = {
  COLORS,
  LIMITS,
  truncate,
  truncateDescription,

  /** Generic informational embed (blue). */
  info(client, options = {}) {
    return applyOptions(baseEmbed(client, COLORS.INFO), options);
  },

  /** Success confirmation (green). */
  success(client, options = {}) {
    const opts = { ...options };
    if (opts.description && !opts.description.startsWith("✅")) {
      opts.description = `✅ ${opts.description}`;
    }
    return applyOptions(baseEmbed(client, COLORS.SUCCESS), opts);
  },

  /** Error message — keep human-friendly, never paste raw stack traces. */
  error(client, options = {}) {
    const opts = { ...options };
    if (opts.description && !opts.description.startsWith("❌")) {
      opts.description = `❌ ${opts.description}`;
    }
    return applyOptions(baseEmbed(client, COLORS.ERROR), opts);
  },

  /** Warning / non-fatal notice (yellow). */
  warning(client, options = {}) {
    const opts = { ...options };
    if (opts.description && !opts.description.startsWith("⚠️")) {
      opts.description = `⚠️ ${opts.description}`;
    }
    return applyOptions(baseEmbed(client, COLORS.WARNING), opts);
  },

  /** Music-related embed (purple). Used by now-playing, queue, lyrics. */
  music(client, options = {}) {
    return applyOptions(baseEmbed(client, COLORS.MUSIC), options);
  },

  /**
   * Custom-color embed for cases the bot owner wants to honor `EMBED_COLOR`.
   * Fall back to INFO if client.color is missing.
   */
  brand(client, options = {}) {
    const color = client?.color || COLORS.INFO;
    return applyOptions(baseEmbed(client, color), options);
  },

  /**
   * Map a raw Error into a user-facing description without leaking stacks
   * or internal types. Used by `replyError` in utils/interactions.js.
   */
  formatError(err) {
    if (!err) return "Terjadi kesalahan tak diketahui.";
    if (typeof err === "string") return err;
    // Whitelist known user-facing error codes if they ever surface
    const message = err.message || String(err);
    // Strip common JS framing
    return message
      .replace(/^TypeError:\s*/, "")
      .replace(/^Error:\s*/, "")
      .replace(/^\w+Error:\s*/, "")
      .slice(0, 500);
  },
};

module.exports = Embeds;
