module.exports = {
  testMatch: ["**/tests/**/*.test.js"],
  coverageDirectory: "<rootDir>/tests/logs/coverage",
  testTimeout: 15000,
  clearMocks: true,
  restoreMocks: false,
  setupFilesAfterEnv: ["<rootDir>/tests/setupAfterEnv.js"],
  coverageThreshold: {
    global: {
      statements: 68,
      branches: 54,
      functions: 64,
      lines: 70,
    },
    "./src/lib/interactions.js": {
      statements: 85,
    },
    "./src/lib/embeds.js": {
      statements: 90,
    },
    "./src/persistence/jsonStorage.js": {
      statements: 85,
    },
    "./src/persistence/levelStorage.js": {
      statements: 85,
    },
    "./src/features/music/musicHelper.js": {
      statements: 80,
    },
    "./src/events/client/clientReady.js": {
      statements: 75,
    },
    "./src/commands/slash/music/skip.js": {
      statements: 95,
    },
    "./src/commands/slash/music/pause.js": {
      statements: 100,
    },
    "./src/commands/slash/music/resume.js": {
      statements: 100,
    },
    "./src/commands/slash/music/queue.js": {
      statements: 95,
    },
    "./src/commands/slash/music/remove.js": {
      statements: 100,
    },
    "./src/commands/slash/music/lyrics.js": {
      statements: 100,
    },
    "./src/commands/prefix/music/skip.js": {
      statements: 100,
    },
    "./src/commands/prefix/music/pause.js": {
      statements: 100,
    },
    "./src/commands/prefix/music/resume.js": {
      statements: 100,
    },
    "./src/commands/prefix/music/queue.js": {
      statements: 96,
    },
    "./src/commands/prefix/music/remove.js": {
      statements: 100,
    },
    "./src/commands/prefix/music/lyrics.js": {
      statements: 100,
    },
    "./src/events/player/ready.js": {
      statements: 100,
    },
    "./src/events/player/error.js": {
      statements: 100,
    },
    "./src/events/track/playerEnd.js": {
      statements: 100,
    },
    "./src/events/track/playerStart.js": {
      statements: 94,
    },
    "./src/events/track/queueEnd.js": {
      statements: 100,
    },
    "./src/events/track/trackEnd.js": {
      statements: 100,
    },
    "./src/events/track/playerException.js": {
      statements: 100,
    },
    "./src/events/track/playerStuck.js": {
      statements: 100,
    },
  },
};
