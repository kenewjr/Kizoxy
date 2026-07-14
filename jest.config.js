module.exports = {
  testMatch: ["**/tests/**/*.test.js"],
  testTimeout: 15000,
  clearMocks: true,
  restoreMocks: false,
  setupFilesAfterEnv: ["<rootDir>/tests/setupAfterEnv.js"],
};
