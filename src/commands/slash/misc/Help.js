const { readdirSync } = require("fs");
const path = require("path");
const Embeds = require("../../../lib/embeds");
const { replyError, safeReply } = require("../../../lib/interactions");
const Logger = require("../../../lib/logger");

const logger = new Logger("HELP");

const CATEGORY_META = {
  music: { title: "🎶 Music", order: 1 },
  tempvoice: { title: "🔊 Temp Voice", order: 2 },
  alarm: { title: "⏰ Alarm", order: 3 },
  level: { title: "🏆 Level", order: 4 },
  anime: { title: "🍙 Anime", order: 5 },
  settings: { title: "⚙️ Settings", order: 6 },
  misc: { title: "📑 Misc", order: 7 },
};

function collectCommands() {
  const commandTypes = [
    { name: "slash", label: "Slash", root: path.join(__dirname, "..", "..") },
    { name: "prefix", label: "Prefix", root: path.join(__dirname, "..", "..") },
  ];
  const allCommands = new Map();

  for (const { name: type, label, root } of commandTypes) {
    const typePath = path.join(root, type);
    let categories;
    try {
      categories = readdirSync(typePath);
    } catch {
      continue;
    }

    for (const category of categories) {
      const categoryPath = path.join(typePath, category);
      let commandFiles;
      try {
        commandFiles = readdirSync(categoryPath).filter((f) =>
          f.endsWith(".js"),
        );
      } catch {
        continue;
      }
      if (!allCommands.has(category)) allCommands.set(category, []);

      for (const file of commandFiles) {
        try {
          const cmd = require(path.join(categoryPath, file));
          if (!cmd.name || !cmd.description) continue;
          allCommands.get(category).push({
            name: Array.isArray(cmd.name) ? cmd.name.join(" ") : cmd.name,
            description: cmd.description,
            type: label,
          });
        } catch (err) {
          logger.error(`Error loading command ${file}: ${err.message}`);
        }
      }
    }
  }
  return allCommands;
}

function buildCategoryFieldValue(commands, prefix) {
  const slash = commands
    .filter((c) => c.type === "Slash")
    .map((c) => `\`/${c.name}\``);
  const pref = commands
    .filter((c) => c.type === "Prefix")
    .map((c) => `\`${prefix}${c.name}\``);
  const shared = commands
    .filter((c) => c.type === "Shared")
    .map((c) => `\`/${c.name}\``);

  const lines = [];
  if (slash.length) lines.push(`**Slash:** ${slash.join(", ")}`);
  if (pref.length) lines.push(`**Prefix:** ${pref.join(", ")}`);
  if (shared.length) lines.push(`**Shared:** ${shared.join(", ")}`);
  return lines.join("\n");
}

module.exports = {
  name: ["help"],
  description: "Show the bot help menu index.",
  category: "Misc",
  run: async (client, interaction) => {
    try {
      const allCommands = collectCommands();
      const totalCommands = [...allCommands.values()].reduce(
        (acc, arr) => acc + arr.length,
        0,
      );

      const sortedCategories = [...allCommands.keys()].sort((a, b) => {
        const oa = CATEGORY_META[a]?.order ?? 99;
        const ob = CATEGORY_META[b]?.order ?? 99;
        if (oa !== ob) return oa - ob;
        return a.localeCompare(b);
      });

      const fields = [];
      for (const category of sortedCategories) {
        const commands = allCommands.get(category);
        if (!commands.length) continue;

        const value = buildCategoryFieldValue(commands, client.prefix);
        if (!value) continue;

        const meta = CATEGORY_META[category] || { title: category };
        fields.push({
          name: `${meta.title} · ${commands.length}`,
          value,
          inline: false,
        });
      }

      const embed = Embeds.brand(client, {
        author: {
          name: `Help — ${interaction.guild.members.me.displayName}`,
          iconURL: interaction.guild.iconURL({ dynamic: true }),
        },
        thumbnail: client.user.displayAvatarURL({ dynamic: true, size: 2048 }),
        description: [
          `The bot supports **slash commands** (\`/\`) and **prefix commands** (\`${client.prefix}\`).`,
          `Total commands: **${totalCommands}** across **${allCommands.size}** categories.`,
          "",
          "Tip: type `/play <title>` to get autocomplete song suggestions.",
        ].join("\n"),
        fields,
      });

      logger.success(`Help command executed by ${interaction.user.tag}`);
      return safeReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error(`Error in help command: ${error.message}`);
      return replyError(
        interaction,
        "Failed to load the command list. Please try again shortly.",
      );
    }
  },
};
