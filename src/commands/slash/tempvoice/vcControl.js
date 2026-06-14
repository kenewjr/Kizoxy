const { ApplicationCommandOptionType, ChannelType } = require("discord.js");
const path = require("path");
const helper = require("../../../features/tempvc/tempVcHelper");
const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");

const logger = new Logger("VC:Control");

// Filter.js-style consolidation: one slash command with an `action` dropdown.
// Each action routes to a lazy-required impl in features/tempvc/actions so the
// slash picker stays a single short command instead of 13 separate ones.
const fileMap = {
  lock: "Lock.js",
  unlock: "Unlock.js",
  hide: "Hide.js",
  show: "Show.js",
  rename: "Rename.js",
  limit: "Limit.js",
  allow: "Allow.js",
  ban: "Ban.js",
  unban: "Unban.js",
  kick: "Kick.js",
  transfer: "Transfer.js",
  template: "Template.js",
  info: "Info.js",
};

const STR = ApplicationCommandOptionType.String;
const INT = ApplicationCommandOptionType.Integer;
const USR = ApplicationCommandOptionType.User;

module.exports = {
  name: ["vc"],
  description: "Control your Temporary Voice Channel",
  category: "Voice",
  options: [
    {
      type: STR,
      name: "action",
      description: "What do you want to do?",
      required: true,
      choices: [
        { name: "🔒 Lock", value: "lock" },
        { name: "🔓 Unlock", value: "unlock" },
        { name: "🙈 Hide", value: "hide" },
        { name: "👁 Show", value: "show" },
        { name: "✏️ Rename", value: "rename" },
        { name: "🔢 Limit", value: "limit" },
        { name: "➕ Allow", value: "allow" },
        { name: "🚫 Ban", value: "ban" },
        { name: "♻️ Unban", value: "unban" },
        { name: "🦵 Kick", value: "kick" },
        { name: "👑 Transfer", value: "transfer" },
        { name: "📋 Template", value: "template" },
        { name: "ℹ️ Info", value: "info" },
      ],
    },
    {
      type: USR,
      name: "user",
      description: "Target user (allow / ban / unban / kick / transfer)",
      required: false,
    },
    {
      type: STR,
      name: "name",
      description: "New channel name (rename)",
      required: false,
    },
    {
      type: INT,
      name: "number",
      description: "User limit 0–99, 0 = unlimited (limit)",
      required: false,
      min_value: 0,
      max_value: 99,
    },
    {
      type: STR,
      name: "template",
      description: "Template ID (template)",
      required: false,
    },
  ],
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const ctx = await helper.validateOwner(interaction);
    if (!ctx) return;

    if (ctx.channel.type !== ChannelType.GuildVoice) {
      return interaction.editReply({
        embeds: [
          Embeds.error(client, {
            title: "Wrong channel type",
            description: "This command only works in voice channels.",
          }),
        ],
      });
    }

    const action = interaction.options.getString("action");
    const fileName = fileMap[action];
    if (!fileName) {
      return interaction.editReply({
        embeds: [
          Embeds.error(client, {
            title: "Unknown action",
            description: "That action is not recognised.",
          }),
        ],
      });
    }

    try {
      const impl = require(
        path.join(__dirname, "../../../features/tempvc/actions", fileName),
      );
      return await impl.run(client, interaction, ctx);
    } catch (err) {
      logger.error(`/vc ${action} failed: ${err.message}`);
      return interaction.editReply({
        embeds: [
          Embeds.error(client, {
            title: "Command failed",
            description: Embeds.formatError(err),
          }),
        ],
      });
    }
  },
};
