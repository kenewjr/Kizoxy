const { Pool } = require("pg");
const Logger = require("./logger");
const logger = new Logger("DATABASE");

let pool = null;

/**
 * Initialize PostgreSQL connection pool.
 * Only connects if POSTGRES_HOST is set in env — otherwise remains disabled (fallback to JSON storage).
 */
function initDatabase() {
  const host = process.env.POSTGRES_HOST;
  if (!host) {
    logger.info(
      "PostgreSQL disabled (POSTGRES_HOST not set). Using JSON file storage.",
    );
    return null;
  }

  pool = new Pool({
    host,
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    database: process.env.POSTGRES_DB || "kizoxy",
    user: process.env.POSTGRES_USER || "kizoxy",
    password: process.env.POSTGRES_PASSWORD || "",
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on("error", (err) => {
    logger.error(`PostgreSQL pool error: ${err.message}`);
  });

  pool.on("connect", () => {
    logger.success("PostgreSQL client connected");
  });

  logger.info(
    `PostgreSQL pool initialized → ${host}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || "kizoxy"}`,
  );
  return pool;
}

/**
 * Get the active database pool. Returns null if DB is disabled.
 */
function getPool() {
  return pool;
}

/**
 * Check if PostgreSQL is available and healthy.
 */
async function healthCheck() {
  if (!pool)
    return { status: "disabled", message: "PostgreSQL not configured" };

  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW() AS now");
    client.release();
    return { status: "healthy", timestamp: result.rows[0].now };
  } catch (err) {
    return { status: "unhealthy", error: err.message };
  }
}

/**
 * Execute a query with parameters.
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {object|null} Query result, or null if DB is disabled
 */
async function query(text, params = []) {
  if (!pool) return null;

  try {
    const result = await pool.query(text, params);
    return result;
  } catch (err) {
    logger.error(`Query error: ${err.message}`);
    throw err;
  }
}

/**
 * Gracefully close all database connections.
 */
async function closeDatabase() {
  if (pool) {
    await pool.end();
    logger.info("PostgreSQL pool closed");
    pool = null;
  }
}

module.exports = {
  initDatabase,
  getPool,
  healthCheck,
  query,
  closeDatabase,
};
