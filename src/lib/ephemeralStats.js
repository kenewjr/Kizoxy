const stats = {
  scheduled: 0,
  fired: 0,
  swallowed: 0,
};

module.exports = {
  stats,
  getEphemeralStats: () => ({ ...stats }),
};
