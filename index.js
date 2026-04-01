const { Client, GatewayIntentBits, Collection, Events } = require("discord.js");
const { Connectors } = require("shoukaku");
const { Kazagumo, Plugins } = require("kazagumo");
const KazagumoSpotify = require("kazagumo-spotify");

const client = new Client({
  shards: "auto",
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  allowedMentions: { parse: ["users", "roles"] },
});

client.config = require("./settings/config.js");
client.prefix = client.config.PREFIX;
client.owner = client.config.OWNER_ID;
client.color = client.config.EMBED_COLOR;
if (!client.token) client.token = client.config.TOKEN;
client.commands = new Collection();
client.buttons = new Collection();
client.aliases = new Collection();
client.prefixCommands = new Map();

const LogStorage = require("./utils/logStorage.js");
client.logStorage = new LogStorage();

// Initialize Shoukaku
const Nodes = client.config.NODES;

// Initialize Kazagumo
client.manager = new Kazagumo(
  {
    defaultSearchEngine: client.config.SEARCH_ENGINE, // 'youtube' | 'soundcloud' | 'youtube_music'
    plugins: [
      new Plugins.PlayerMoved(client),
      new KazagumoSpotify({
        clientId: client.config.spotifyClientID,
        clientSecret: client.config.spotifySecret,
        playlistPageLimit: 50, // optional ( 100 tracks per page )
        albumPageLimit: 50, // optional ( 50 tracks per page )
        searchLimit: 10, // optional ( track search limit. Max 50 )
        searchMarket: "US", // optional || default: US ( Enter the country you live in. [ Can only be of 2 letters. For eg: US, IN, EN ] )//
      }),
    ],
    send: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
  },
  new Connectors.DiscordJS(client),
  Nodes,
  {
    reconnectTries: Infinity,   // terus mencoba selamanya
    reconnectInterval: 15,       // jeda 5 detik antar percobaan
  },
);

[
  "loadCommand",
  "loadPrefix",
  "loadButtons",
  "loadEvent",
  "loadPlayer",
  "loadTrack",
  "loadAlarm",
].forEach((x) => require(`./handlers/${x}`)(client));

require("./api/jikan-api/handlers/loadJikanSchedule")(client);

client.login(client.token);
