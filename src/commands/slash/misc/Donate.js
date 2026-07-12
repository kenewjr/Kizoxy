const Embeds = require("../../../lib/embeds");
const { safeReply } = require("../../../lib/interactions");

module.exports = {
  name: ["donate"],
  description: "Dukung perkembangan bot dengan berdonasi.",
  category: "Misc",
  run: async (client, interaction) => {
    const embed = Embeds.brand(client, {
      title: "❤️ Dukung Kizoxy (Donate)",
      description: [
        "Terima kasih telah menggunakan Kizoxy! Dukungan Anda sangat berarti untuk membantu kami menjaga bot tetap aktif dan terus mengembangkan fitur-fitur baru.",
        "",
        "**Cara Berdonasi:**",
        "• **Tako (Local Payment):** [tako.id/kenewjr]( https://tako.id/kenewjr)",
        "",
      ].join("\n"),
      footer: { text: "Kizoxy Music & Utility Bot" },
    });
    return safeReply(interaction, { embeds: [embed] });
  },
};
