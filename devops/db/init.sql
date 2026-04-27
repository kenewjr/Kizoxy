-- Kizoxy Bot — PostgreSQL Schema
-- Run this script to initialize the database tables.

-- Guild settings (log channel, prefix overrides, etc.)
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id   VARCHAR(20) PRIMARY KEY,
  log_channel_id VARCHAR(20),
  prefix     VARCHAR(10) DEFAULT 'k',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User levels / XP per guild
CREATE TABLE IF NOT EXISTS levels (
  user_id    VARCHAR(20) NOT NULL,
  guild_id   VARCHAR(20) NOT NULL,
  xp         INTEGER     DEFAULT 0,
  level      INTEGER     DEFAULT 0,
  messages   INTEGER     DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, guild_id)
);

-- Alarms / reminders
CREATE TABLE IF NOT EXISTS alarms (
  id          UUID PRIMARY KEY,
  user_id     VARCHAR(20) NOT NULL,
  guild_id    VARCHAR(20) NOT NULL,
  channel_id  VARCHAR(20),
  label       TEXT,
  cron        VARCHAR(100),
  next_run    TIMESTAMPTZ,
  enabled     BOOLEAN DEFAULT TRUE,
  message_id  VARCHAR(20),
  embed_channel_id VARCHAR(20),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Log channel mapping
CREATE TABLE IF NOT EXISTS log_channels (
  guild_id    VARCHAR(20) PRIMARY KEY,
  channel_id  VARCHAR(20) NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- FixEmbed settings per guild
CREATE TABLE IF NOT EXISTS fixembed_settings (
  guild_id             VARCHAR(20) PRIMARY KEY,
  enabled              BOOLEAN DEFAULT TRUE,
  view_mode            VARCHAR(20) DEFAULT 'default',
  base_message_action  VARCHAR(20) DEFAULT 'nothing',
  ignored_keywords     TEXT[] DEFAULT '{}',
  disabled_channels    TEXT[] DEFAULT '{}',
  disabled_roles       TEXT[] DEFAULT '{}',
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_levels_guild ON levels (guild_id);
CREATE INDEX IF NOT EXISTS idx_levels_user ON levels (user_id);
CREATE INDEX IF NOT EXISTS idx_alarms_guild ON alarms (guild_id);
CREATE INDEX IF NOT EXISTS idx_alarms_user ON alarms (user_id);
CREATE INDEX IF NOT EXISTS idx_alarms_next_run ON alarms (next_run) WHERE enabled = TRUE;
