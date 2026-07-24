const { PermissionsBitField } = require("discord.js");
const { replyError } = require("../../../lib/interactions");
const fixembed_panel = require("../../../interactions/buttons/fixembed_panel");

module.exports = {
  name: ["fixembed"],
  description: "Configure automatic link embed fixes and ignore criteria.",
  category: "Settings",
  defaultMemberPermissions: PermissionsBitField.Flags.ManageGuild,
  run: async (client, interaction) => {
    if (!interaction.memberPermissions?.has?.("ManageGuild")) {
      return replyError(
        interaction,
        "You need the **Manage Server** permission to run this command.",
      );
    }

    await fixembed_panel.showMain(interaction, client);
  },
};
