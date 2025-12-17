const { ApplicationCommandOptionType } = require("discord.js");
const path = require("path");

module.exports = {
  name: ["filter"],
  description: "Apply various audio filters",
  category: "Music",
  options: [
    {
      name: "type",
      description: "Select the filter type to apply",
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: "Reset", value: "reset" },
        { name: "3D", value: "3d" },
        { name: "BassBoost", value: "bassboost" },
        { name: "DoubleTime", value: "doubletime" },
        { name: "Karaoke", value: "karaoke" },
        { name: "NightCore", value: "nightcore" },
        { name: "SlowMotion", value: "slowmotion" },
        { name: "Vibrato", value: "vibrato" },
      ],
    },
    {
      name: "amount",
      description: "Amount for BassBoost (ignored for other filters) -10 to 10",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      min_value: -10,
      max_value: 10,
    },
  ],
  run: async (client, interaction) => {
    // Get the selected filter type from options
    const subcommand = interaction.options.getString("type");
    
    // Map choice value to filename
    const fileMap = {
        "reset": "Reset.js",
        "3d": "3d.js",
        "bassboost": "BassBoost.js",
        "doubletime": "DoubleTime.js",
        "karaoke": "Karaoke.js",
        "nightcore": "Nightcore.js",
        "slowmotion": "SlowMotion.js",
        "vibrato": "Vibrato.js"
    };

    const fileName = fileMap[subcommand];
    if (!fileName) return interaction.reply({ content: "❌ Unknown filter type.", ephemeral: true });

    try {
        const cmd = require(path.join(__dirname, "../../../modules/Filter", fileName));
        // Execute the command logic
        await cmd.run(client, interaction);
    } catch (error) {
        console.error(`Error loading/executing filter ${subcommand}:`, error);
        // Reply only if not already replied
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "❌ Failed to execute filter.", ephemeral: true });
        } else {
             await interaction.editReply({ content: "❌ Failed to execute filter." });
        }
    }
  },
};
