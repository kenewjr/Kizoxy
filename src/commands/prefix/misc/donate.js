const Embeds = require("../../../lib/embeds");

module.exports = {
  name: "donate",
  aliases: ["donasi"],
  description: "Dukung perkembangan bot dengan berdonasi.",
  category: "Misc",
  run: async (client, message, _args) => {
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
    return message.channel.send({ embeds: [embed] }).catch(() => {});
  },
};
