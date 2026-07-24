const { readdirSync } = require("fs");
const path = require("path");
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const Embeds = require("../../../lib/embeds");
const { replyError, safeReply } = require("../../../lib/interactions");
const Logger = require("../../../lib/logger");
const commandStorage = require("../../../persistence/commandStorage");

const logger = new Logger("HELP");

const CATEGORY_META = {
  music: { title: "🎶 Music", order: 1 },
  tempvoice: { title: "🔊 Temp Voice", order: 2 },
  alarm: { title: "⏰ Alarm", order: 3 },
  level: { title: "🏆 Level", order: 4 },
  settings: { title: "⚙️ Settings", order: 5 },
  youtube: { title: "📢 YouTube", order: 6 },
  tiktok: { title: "🎵 TikTok", order: 7 },
  misc: { title: "📑 Misc", order: 8 },
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
      if (category.toLowerCase() === "owner") continue;

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
          if (cmd.ownerOnly) continue;

          const cmdName = Array.isArray(cmd.name)
            ? cmd.name.join(" ")
            : cmd.name;
          const custom = commandStorage.data[cmdName] || {};

          allCommands.get(category).push({
            name: cmdName,
            displayName: custom.displayName || cmdName,
            description: custom.description || cmd.description,
            type: label,
          });
        } catch (err) {
          logger.error(`Error loading command ${file}: ${err.message}`);
        }
      }

      if (allCommands.get(category).length === 0) {
        allCommands.delete(category);
      }
    }
  }
  return allCommands;
}

function getSortedCategories(allCommands) {
  return [...allCommands.keys()].sort((a, b) => {
    const oa = CATEGORY_META[a]?.order ?? 99;
    const ob = CATEGORY_META[b]?.order ?? 99;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });
}

function buildHomeEmbed(client, guild, totalCommands, totalCategories) {
  const prefix = client.prefix || client.config?.PREFIX || "k";

  function getCmdName(name, original) {
    const custom = commandStorage.data[name];
    return custom?.displayName ? custom.displayName : original;
  }

  return Embeds.brand(client, {
    author: {
      name: `Help — ${guild.members.me.displayName}`,
      iconURL: guild.iconURL({ dynamic: true }),
    },
    thumbnail: client.user.displayAvatarURL({ dynamic: true, size: 2048 }),
    description: [
      `The bot supports **slash commands** (\`/\`) and **prefix commands** (\`${prefix}\`).`,
      `Total commands: **${totalCommands}** across **${totalCategories}** categories.`,
      "",
      "### ✨ Feature Highlights",
      `🎶 **/${getCmdName("play", "play")}**: Play any song or playlist in a voice channel.`,
      `🔊 **/${getCmdName("vcsetup", "vcsetup")}**: Initialize temporary voice channel generator.`,
      `⏰ **/${getCmdName("alarm", "alarm")}**: Manage recurring alarms and reminders.`,
      `🏆 **/${getCmdName("rank", "rank")}**: View your current XP level and leaderboard ranking.`,
      `📢 **/${getCmdName("youtube list", "youtube list")}**: Manage YouTube notification subscriptions.`,
      `🎵 **/${getCmdName("tiktok list", "tiktok list")}**: Manage TikTok notification subscriptions.`,
      "",
      "Use the dropdown select menu below to view all commands for a specific category.",
    ].join("\n"),
  });
}

function buildCategoryEmbed(client, category, commands) {
  const prefix = client.prefix || client.config?.PREFIX || "k";
  const meta = CATEGORY_META[category] || { title: category };

  const slashCmds = commands.filter((c) => c.type !== "Prefix");
  const prefixCmds = commands.filter((c) => c.type === "Prefix");

  const lines = [];
  if (slashCmds.length) {
    lines.push("### 💻 Slash Commands");
    lines.push(
      slashCmds
        .map((c) => `\`/${c.displayName || c.name}\` — ${c.description}`)
        .join("\n"),
    );
  }
  if (prefixCmds.length) {
    if (lines.length) {
      lines.push("", "---", "");
    }
    lines.push(`### ⌨️ Prefix Commands (Prefix: \`${prefix}\`)`);
    lines.push(
      prefixCmds
        .map(
          (c) => `\`${prefix}${c.displayName || c.name}\` — ${c.description}`,
        )
        .join("\n"),
    );
  }

  return Embeds.brand(client, {
    title: `${meta.title} Commands`,
    description: lines.join("\n") || "No commands found in this category.",
    footerText: `Category: ${meta.title} • Kizoxy Help`,
  });
}

function buildHelpComponents(sortedCategories, activeCategory = null) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("help_category:select")
    .setPlaceholder("Select a category to view commands...")
    .addOptions(
      sortedCategories.map((cat) => {
        const meta = CATEGORY_META[cat] || { title: cat };
        return {
          label: meta.title,
          value: cat,
          default: cat === activeCategory,
        };
      }),
    );

  const menuRow = new ActionRowBuilder().addComponents(menu);

  if (activeCategory) {
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("help_category:home")
        .setLabel("Home")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🏠"),
    );
    return [menuRow, buttonRow];
  }

  return [menuRow];
}

module.exports = {
  name: ["help"],
  description: "Show the bot help menu index.",
  category: "Misc",
  collectCommands,
  getSortedCategories,
  buildHomeEmbed,
  buildCategoryEmbed,
  buildHelpComponents,
  run: async (client, interaction) => {
    try {
      const allCommands = collectCommands();
      const totalCommands = [...allCommands.values()].reduce(
        (acc, arr) => acc + arr.length,
        0,
      );
      const sortedCategories = getSortedCategories(allCommands);

      const embed = buildHomeEmbed(
        client,
        interaction.guild,
        totalCommands,
        allCommands.size,
      );
      const components = buildHelpComponents(sortedCategories);

      logger.success(`Help command index executed by ${interaction.user.tag}`);
      return safeReply(interaction, { embeds: [embed], components });
    } catch (error) {
      logger.error(`Error in help command: ${error.message}`);
      return replyError(
        interaction,
        "Failed to load the command list. Please try again shortly.",
      );
    }
  },
};
