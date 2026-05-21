// modules/fixembed/resolvers/index.js
// Aggregates per-category resolver lists into a single ordered array.
// Order matters: more specific patterns should come before generic ones.

const social = require("./social");
const media = require("./media");
const art = require("./art");
const embedez = require("./embedez");

module.exports = [...social, ...media, ...art, ...embedez];
