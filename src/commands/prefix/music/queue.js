const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");
const formatDuration = require("../../../lib/FormatDuration");
const { createCollector } = require("../../../lib/interactions");
const {
  validateMusicContextMessage,
} = require("../../../features/music/musicHelper");

const logger = new Logger("PREFIX-QUEUE");

const PAGE_SIZE = 10;
const COLLECTOR_TTL_MS = 60000;

function buildNavRow(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("kqueue:first")
      .setEmoji("⏮️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId("kqueue:prev")
      .setEmoji("⬅️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId("kqueue:indicator")
      .setLabel(`${page + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("kqueue:next")
      .setEmoji("➡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId("kqueue:last")
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

function buildPages(client, message, player) {
  const song = player.queue.current;
  const qduration = formatDuration(player.queue.durationLength + song.length);

  const totalPages = Math.max(1, Math.ceil(player.queue.length / PAGE_SIZE));
  const songStrings = [];
  for (let i = 0; i < player.queue.length; i++) {
    const track = player.queue[i];
    songStrings.push(
      `**${i + 1}.** [${track.title}](${track.uri}) \`[${formatDuration(track.length)}]\` • ${track.requester}\n`,
    );
  }

  const pages = [];
  for (let i = 0; i < totalPages; i++) {
    const str = songStrings
      .slice(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE)
      .join("");
    const embed = Embeds.brand(client, {
      author: {
        name: `Queue - ${message.guild.name}`,
        iconURL: message.guild.iconURL({ dynamic: true }),
      },
      description: `**Currently Playing**\n[${song.title}](${song.uri}) \`[${formatDuration(song.length)}]\` • ${song.requester}\n\n**Rest of queue**:${str === "" ? "  Nothing" : "\n" + str}`,
      footerText: `Page • ${i + 1}/${totalPages} | ${player.queue.length} • Song/s | ${qduration} • Total Duration`,
    });
    embed.setThumbnail(song.thumbnail || client.user.displayAvatarURL());
    pages.push(embed);
  }
  return pages;
}

module.exports = {
  name: "queue",
  aliases: ["q"],
  description: "Show the song queue.",
  category: "music",
  run: async (client, message) => {
    const ctx = validateMusicContextMessage(client, message);
    if (ctx.error) return message.reply(ctx.error);

    try {
      const { player } = ctx;
      if (!player.queue?.current)
        return message.channel.send("❌ Nothing is playing.");

      const pages = buildPages(client, message, player);
      if (pages.length === 1)
        return message.channel.send({ embeds: [pages[0]] });

      let page = 0;
      const sent = await message.channel.send({
        embeds: [pages[page]],
        components: [buildNavRow(page, pages.length)],
      });

      const collector = createCollector(sent, {
        filter: (i) => i.user.id === message.author.id,
        time: COLLECTOR_TTL_MS,
        notifyOnTimeout: false,
      });

      collector.on("collect", async (i) => {
        const action = i.customId.split(":")[1];
        if (action === "first") page = 0;
        else if (action === "prev") page = Math.max(0, page - 1);
        else if (action === "next") page = Math.min(pages.length - 1, page + 1);
        else if (action === "last") page = pages.length - 1;

        await i
          .update({
            embeds: [pages[page]],
            components: [buildNavRow(page, pages.length)],
          })
          .catch(() => {});
      });

      return;
    } catch (err) {
      logger.error(`kqueue failed: ${err.message}`);
      return message.reply("❌ Failed to show the queue.");
    }
  },
};
