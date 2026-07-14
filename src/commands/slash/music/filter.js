const { ApplicationCommandOptionType } = require("discord.js");
const Embeds = require("../../../lib/embeds");

module.exports = {
  name: ["filter"],
  description: "Apply or toggle audio filters (stackable).",
  category: "Music",
  options: [
    {
      name: "type",
      description: "Select the filter to toggle/apply",
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: "Reset All", value: "reset" },
        { name: "Toggle 3D", value: "3d" },
        { name: "Toggle BassBoost", value: "bassboost" },
        { name: "Toggle DoubleTime", value: "doubletime" },
        { name: "Toggle Karaoke", value: "karaoke" },
        { name: "Toggle NightCore", value: "nightcore" },
        { name: "Toggle SlowMotion", value: "slowmotion" },
        { name: "Toggle Vibrato", value: "vibrato" },
      ],
    },
    {
      name: "amount",
      description: "Amount for BassBoost (gain scale -10 to 10)",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      min_value: -10,
      max_value: 10,
    },
  ],
  run: async (client, interaction) => {
    await interaction.reply("Applying filter update...");

    const subcommand = interaction.options.getString("type");
    const amount = interaction.options.getInteger("amount");

    const player = client.manager.players.get(interaction.guild.id);
    if (!player) return interaction.editReply(`No playing in this guild!`);
    const { channel } = interaction.member.voice;
    if (
      !channel ||
      interaction.member.voice.channel !==
        interaction.guild.members.me.voice.channel
    )
      return interaction.editReply(`I'm not in the same voice channel as you!`);

    if (!client.applyPlayerFilter) {
      client.applyPlayerFilter = async function (guildId, type, amt = null) {
        const p = client.manager.players.get(guildId);
        if (!p) throw new Error("No player found");
        if (!p.filtersState) p.filtersState = {};

        if (type === "reset") {
          p.filtersState = {};
          await p.shoukaku.setFilters({});
          await p.setVolume(100);
          return p.filtersState;
        }

        if (type === "3d") {
          if (p.filtersState.rotation) delete p.filtersState.rotation;
          else p.filtersState.rotation = { rotationHz: 0.2 };
        } else if (type === "bassboost") {
          if (p.filtersState.equalizer) delete p.filtersState.equalizer;
          else {
            const val = amt !== null ? amt : 5;
            p.filtersState.equalizer = [
              { band: 0, gain: val / 10 },
              { band: 1, gain: val / 10 },
              { band: 2, gain: val / 10 },
              { band: 3, gain: val / 10 },
              { band: 4, gain: val / 10 },
              { band: 5, gain: val / 10 },
              { band: 6, gain: val / 10 },
              { band: 7, gain: 0 },
              { band: 8, gain: 0 },
              { band: 9, gain: 0 },
              { band: 10, gain: 0 },
              { band: 11, gain: 0 },
              { band: 12, gain: 0 },
              { band: 13, gain: 0 },
            ];
          }
        } else if (type === "doubletime") {
          if (p.filtersState.timescale) delete p.filtersState.timescale;
          else p.filtersState.timescale = { speed: 1.5, pitch: 1.0, rate: 1.0 };
        } else if (type === "slowmotion") {
          if (p.filtersState.timescale) delete p.filtersState.timescale;
          else p.filtersState.timescale = { speed: 0.7, pitch: 1.0, rate: 1.0 };
        } else if (type === "nightcore") {
          if (p.filtersState.timescale) delete p.filtersState.timescale;
          else
            p.filtersState.timescale = {
              speed: 1.165,
              pitch: 1.125,
              rate: 1.05,
            };
        } else if (type === "karaoke") {
          if (p.filtersState.karaoke) delete p.filtersState.karaoke;
          else
            p.filtersState.karaoke = {
              level: 1.0,
              monoLevel: 1.0,
              filterBand: 220.0,
              filterWidth: 100.0,
            };
        } else if (type === "vibrato") {
          if (p.filtersState.vibrato) delete p.filtersState.vibrato;
          else p.filtersState.vibrato = { frequency: 2.0, depth: 0.5 };
        }

        await p.shoukaku.setFilters(p.filtersState);
        return p.filtersState;
      };
    }

    try {
      const state = await client.applyPlayerFilter(
        interaction.guild.id,
        subcommand,
        amount,
      );
      const active = Object.keys(state).filter((k) => state[k]);
      const embed = Embeds.brand(client, {
        description: `💠 | **Filters Updated!**\nActive Filters: ${active.length > 0 ? active.map((a) => `\`${a}\``).join(", ") : "`None`"}`,
      });
      setTimeout(
        () => interaction.editReply({ content: " ", embeds: [embed] }),
        2000,
      );
    } catch (err) {
      await interaction.editReply(`❌ Failed to update filter: ${err.message}`);
    }
  },
};
