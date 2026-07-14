// ── Discord Client mock ──────────────────────────────────────
function createMockClient(overrides = {}) {
  return {
    user: {
      id: "111111111111111111",
      username: "Kizoxy",
      tag: "Kizoxy#0000",
      displayAvatarURL: () => "https://cdn.discordapp.com/avatars/test.png",
      setUsername: jest.fn().mockResolvedValue({}),
      setPresence: jest.fn().mockResolvedValue({}),
      setActivity: jest.fn().mockResolvedValue({}),
    },
    guilds: {
      cache: new Map(),
      fetch: jest.fn().mockResolvedValue(new Map()),
    },
    commands: new Map(),
    prefixCommands: new Map(),
    buttons: new Map(),
    color: "#5865F2",
    ws: { status: 0 }, // 0 = READY
    kazagumo: null, // override in music tests
    alarmScheduler: { jobs: new Map() },
    levelStorage: null, // override in level tests
    ...overrides,
  };
}

// ── Guild mock ───────────────────────────────────────────────
function createMockGuild(overrides = {}) {
  const guild = {
    id: "222222222222222222",
    name: "Test Server",
    memberCount: 10,
    ownerId: "333333333333333333",
    joinedAt: new Date("2026-01-01"),
    iconURL: () => null,
    channels: {
      cache: new Map(),
      fetch: jest.fn(),
    },
    members: {
      cache: new Map(),
      fetch: jest.fn().mockResolvedValue(new Map()),
    },
    roles: {
      cache: new Map(),
    },
    ...overrides,
  };
  // Add a default text channel
  const textChannel = createMockTextChannel({ guild });
  guild.channels.cache.set(textChannel.id, textChannel);
  return guild;
}

// ── Text Channel mock ────────────────────────────────────────
function createMockTextChannel(overrides = {}) {
  return {
    id: "444444444444444444",
    name: "general",
    type: 0, // GuildText
    position: 0,
    send: jest.fn().mockResolvedValue({ id: "999999999999999999" }),
    isTextBased: () => true,
    isThread: () => false,
    isVoiceBased: () => false,
    permissionsFor: () => ({
      has: () => true,
    }),
    ...overrides,
  };
}

// ── Voice Channel mock ───────────────────────────────────────
function createMockVoiceChannel(overrides = {}) {
  return {
    id: "555555555555555555",
    name: "Test Voice",
    type: 2, // GuildVoice
    members: new Map(),
    isVoiceBased: () => true,
    isTextBased: () => false,
    delete: jest.fn().mockResolvedValue({}),
    edit: jest.fn().mockResolvedValue({}),
    permissionOverwrites: {
      edit: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      cache: new Map(),
    },
    ...overrides,
  };
}

// ── Slash Command Interaction mock ───────────────────────────
function createMockInteraction(overrides = {}) {
  const optionsMap = overrides._options ?? {};
  const interaction = {
    id: "666666666666666666",
    type: 2, // ApplicationCommand
    user: { id: "777777777777777777", username: "testuser", bot: false },
    member: {
      id: "777777777777777777",
      displayName: "testuser",
      voice: { channel: null },
      permissions: { has: () => false },
    },
    guild: null, // set in test
    channel: null, // set in test
    replied: false,
    deferred: false,
    reply: jest.fn().mockImplementation(async function () {
      interaction.replied = true;
      return {};
    }),
    deferReply: jest.fn().mockImplementation(async function () {
      interaction.deferred = true;
      return {};
    }),
    editReply: jest.fn().mockResolvedValue({}),
    followUp: jest.fn().mockResolvedValue({}),
    deleteReply: jest.fn().mockResolvedValue({}),
    showModal: jest.fn().mockResolvedValue({}),
    options: {
      getString: (name, _required) => optionsMap[name] ?? null,
      getInteger: (name, _required) => optionsMap[name] ?? null,
      getBoolean: (name, _required) => optionsMap[name] ?? null,
      getUser: (name, _required) => optionsMap[name] ?? null,
      getMember: (name, _required) => optionsMap[name] ?? null,
      getChannel: (name, _required) => optionsMap[name] ?? null,
      getRole: (name, _required) => optionsMap[name] ?? null,
      getNumber: (name, _required) => optionsMap[name] ?? null,
      getSubcommand: () => optionsMap._subcommand ?? null,
      getSubcommandGroup: () => optionsMap._group ?? null,
      data: [],
    },
    isRepliable: () => true,
    isChatInputCommand: () => true,
    ...overrides,
  };
  delete interaction._options;
  return interaction;
}

// ── Prefix Message mock ──────────────────────────────────────
function createMockMessage(overrides = {}) {
  return {
    id: "888888888888888888",
    content: "",
    author: { id: "777777777777777777", username: "testuser", bot: false },
    member: {
      id: "777777777777777777",
      displayName: "testuser",
      voice: { channel: null },
      permissions: { has: () => false },
    },
    guild: null,
    channel: null,
    reply: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    react: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

// ── Button Interaction mock ──────────────────────────────────
function createMockButtonInteraction(customId, overrides = {}) {
  return {
    ...createMockInteraction(overrides),
    customId,
    componentType: 2, // Button
    message: {
      id: "000000000000000001",
      edit: jest.fn().mockResolvedValue({}),
    },
    update: jest.fn().mockResolvedValue({}),
    isButton: () => true,
    isChatInputCommand: () => false,
  };
}

// ── Kazagumo Player mock ─────────────────────────────────────
function createMockPlayer(overrides = {}) {
  return {
    guildId: "222222222222222222",
    playing: true,
    paused: false,
    loop: "none",
    volume: 100,
    position: 30000,
    filters: {},
    queue: Object.assign(
      [
        {
          title: "Test Song 2",
          author: "Test Artist 2",
          uri: "https://youtube.com/watch?v=test2",
          length: 200000,
        },
      ],
      {
        current: {
          title: "Test Song",
          author: "Test Artist",
          uri: "https://youtube.com/watch?v=test",
          length: 200000,
          requester: { id: "777777777777777777", username: "testuser" },
        },
        size: 2,
        totalSize: 3,
        clear: jest.fn(),
        add: jest.fn(),
        remove: jest.fn(),
        shuffle: jest.fn(),
      },
    ),
    data: { nowPlayingMessage: null, nowPlayingEmbed: null, lyricsEmbed: null },
    skip: jest.fn().mockResolvedValue({}),
    pause: jest.fn().mockResolvedValue({}),
    resume: jest.fn().mockResolvedValue({}),
    stop: jest.fn().mockResolvedValue({}),
    setVolume: jest.fn().mockResolvedValue({}),
    setLoop: jest.fn().mockResolvedValue({}),
    setFilters: jest.fn().mockResolvedValue({}),
    shuffle: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

// ── Supertest app factory ────────────────────────────────────
function createTestApp(clientOverrides = {}) {
  const client = createMockClient(clientOverrides);
  const createDashboard = require("../../src/dashboard/server");
  return { app: createDashboard(client), client };
}

module.exports = {
  createMockClient,
  createMockGuild,
  createMockTextChannel,
  createMockVoiceChannel,
  createMockInteraction,
  createMockMessage,
  createMockButtonInteraction,
  createMockPlayer,
  createTestApp,
};
