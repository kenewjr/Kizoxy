const Logger = require("../../utils/logger");
const logger = new Logger("LAVALINK");

module.exports = async (client, name, code, reason) => {
  const reasonText = reason || "No reason provided";

  if (code >= 4000) {
    logger.error(
      `Node ${name}: Connection closed abnormally - Code ${code}, Reason: ${reasonText}`,
    );
  } else {
    logger.warning(
      `Node ${name}: Connection closed - Code ${code}, Reason: ${reasonText}`,
    );
  }
};
