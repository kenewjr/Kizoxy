const Logger = require("../lib/logger");
const logger = new Logger("TEMPVC_STORAGE");
const JSONStorage = require("./jsonStorage");

const DEFAULT_SETTINGS = {
  maxGenerators: 2,
  maxTemplates: 3,
  maxVoiceRoles: 1,
  maxInterfaces: 1,
  isPremium: false,
};

function defaultGuildData() {
  return {
    generators: {},
    tempChannels: {},
    templates: {},
    voiceRoles: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

// Lightweight unique id without an extra dep. Sufficient for templates and
// voiceRoles where collisions across a single guild are statistically irrelevant.
function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeNum(val, def = 0) {
  return Number.isInteger(val) ? val : def;
}

function arrayCopy(val) {
  return Array.isArray(val) ? [...val] : [];
}

class TempVcStorage extends JSONStorage {
  constructor(filename = "tempvc.json") {
    super(filename);
  }

  async _guild(guildId) {
    await this._ensureLoaded();
    if (!guildId) throw new Error("guildId is required");
    let g = this.data[guildId];
    if (!g) {
      g = defaultGuildData();
      this.data[guildId] = g;
      return g;
    }
    if (!g.generators) g.generators = {};
    if (!g.tempChannels) g.tempChannels = {};
    if (!g.templates) g.templates = {};
    if (!Array.isArray(g.voiceRoles)) g.voiceRoles = [];
    g.settings = { ...DEFAULT_SETTINGS, ...(g.settings || {}) };
    return g;
  }

  async getGenerator(guildId, channelId) {
    const g = await this._guild(guildId);
    return g.generators[channelId] || null;
  }

  async getAllGenerators(guildId) {
    const g = await this._guild(guildId);
    return Object.values(g.generators);
  }

  async addGenerator(guildId, generatorData) {
    if (!generatorData || !generatorData.id) {
      throw new Error(
        "addGenerator requires generatorData.id (voice channel id)",
      );
    }
    const g = await this._guild(guildId);
    const record = {
      id: generatorData.id,
      categoryId: generatorData.categoryId ?? null,
      defaultName: generatorData.defaultName ?? "{username}'s Channel",
      defaultLimit: Number.isInteger(generatorData.defaultLimit)
        ? generatorData.defaultLimit
        : 0,
      defaultBitrate: Number.isInteger(generatorData.defaultBitrate)
        ? generatorData.defaultBitrate
        : 64000,
      bitrate: Number.isInteger(generatorData.bitrate)
        ? generatorData.bitrate
        : Number.isInteger(generatorData.defaultBitrate)
          ? Math.round(generatorData.defaultBitrate / 1000)
          : 64,
      rtcRegion: generatorData.rtcRegion ?? null,
      templateId: generatorData.templateId ?? null,
      createdAt: generatorData.createdAt ?? Date.now(),
    };
    g.generators[record.id] = record;
    this.scheduleSave();
    logger.info(`Generator added in ${guildId}: ${record.id}`);
    return record;
  }

  async updateGenerator(guildId, channelId, updates) {
    const g = await this._guild(guildId);
    const existing = g.generators[channelId];
    if (!existing) return null;
    g.generators[channelId] = { ...existing, ...updates, id: existing.id };
    this.scheduleSave();
    return g.generators[channelId];
  }

  async removeGenerator(guildId, channelId) {
    const g = await this._guild(guildId);
    if (!g.generators[channelId]) return false;
    delete g.generators[channelId];
    this.scheduleSave();
    logger.info(`Generator removed in ${guildId}: ${channelId}`);
    return true;
  }

  async getTempChannel(guildId, channelId) {
    const g = await this._guild(guildId);
    return g.tempChannels[channelId] || null;
  }

  async getAllTempChannels(guildId) {
    const g = await this._guild(guildId);
    return Object.values(g.tempChannels);
  }

  async getTempChannelByOwner(guildId, ownerId) {
    const g = await this._guild(guildId);
    return (
      Object.values(g.tempChannels).find((c) => c.ownerId === ownerId) || null
    );
  }

  async addTempChannel(guildId, channelData) {
    if (!channelData || !channelData.id) {
      throw new Error("addTempChannel requires channelData.id");
    }
    const g = await this._guild(guildId);
    const record = {
      id: channelData.id,
      generatorId: channelData.generatorId || null,
      ownerId: channelData.ownerId,
      guildId,
      name: channelData.name || "",
      limit: safeNum(channelData.limit),
      isLocked: !!channelData.isLocked,
      isHidden: !!channelData.isHidden,
      allowedUsers: arrayCopy(channelData.allowedUsers),
      bannedUsers: arrayCopy(channelData.bannedUsers),
      interfaceMessageId: channelData.interfaceMessageId || null,
      interfaceChannelId: channelData.interfaceChannelId || null,
      pinnedInfoMessageId: channelData.pinnedInfoMessageId || null,
      templateId: channelData.templateId || null,
      createdAt: channelData.createdAt || Date.now(),
    };
    g.tempChannels[record.id] = record;
    this.scheduleSave();
    return record;
  }

  async updateTempChannel(guildId, channelId, updates) {
    const g = await this._guild(guildId);
    const existing = g.tempChannels[channelId];
    if (!existing) return null;
    g.tempChannels[channelId] = {
      ...existing,
      ...updates,
      id: existing.id,
      guildId,
    };
    this.scheduleSave();
    return g.tempChannels[channelId];
  }

  async removeTempChannel(guildId, channelId) {
    const g = await this._guild(guildId);
    if (!g.tempChannels[channelId]) return false;
    delete g.tempChannels[channelId];
    this.scheduleSave();
    return true;
  }

  async getTemplate(guildId, templateId) {
    const g = await this._guild(guildId);
    return g.templates[templateId] || null;
  }

  async getAllTemplates(guildId) {
    const g = await this._guild(guildId);
    return Object.values(g.templates);
  }

  async addTemplate(guildId, templateData) {
    const g = await this._guild(guildId);
    const td = templateData || {};
    const id = td.id || generateId();
    const record = {
      id,
      name: td.name || "Untitled",
      channelName: td.channelName || "{username}'s Channel",
      namePattern: td.namePattern || null,
      limit: safeNum(td.limit),
      bitrate: safeNum(td.bitrate, 64000),
      isLocked: !!td.isLocked,
      isHidden: !!td.isHidden,
      createdBy: td.createdBy || null,
      createdAt: td.createdAt || Date.now(),
    };
    g.templates[id] = record;
    this.scheduleSave();
    return record;
  }

  async updateTemplate(guildId, templateId, updates) {
    const g = await this._guild(guildId);
    const existing = g.templates[templateId];
    if (!existing) return null;
    g.templates[templateId] = { ...existing, ...updates, id: existing.id };
    this.scheduleSave();
    return g.templates[templateId];
  }

  async removeTemplate(guildId, templateId) {
    const g = await this._guild(guildId);
    if (!g.templates[templateId]) return false;
    delete g.templates[templateId];
    this.scheduleSave();
    return true;
  }

  async getVoiceRoles(guildId) {
    const g = await this._guild(guildId);
    return [...g.voiceRoles];
  }

  async getVoiceRolesForChannel(guildId, channelId) {
    const g = await this._guild(guildId);
    return g.voiceRoles.filter((vr) => vr.channelId === channelId);
  }

  async addVoiceRole(guildId, voiceRoleData) {
    if (!voiceRoleData || !voiceRoleData.channelId || !voiceRoleData.roleId) {
      throw new Error(
        "addVoiceRole requires voiceRoleData.channelId and voiceRoleData.roleId",
      );
    }
    const g = await this._guild(guildId);
    const record = {
      id: voiceRoleData.id || generateId(),
      channelId: voiceRoleData.channelId,
      roleId: voiceRoleData.roleId,
      ownerOnly: Boolean(voiceRoleData.ownerOnly),
      createdAt: voiceRoleData.createdAt ?? Date.now(),
    };
    g.voiceRoles.push(record);
    this.scheduleSave();
    return record;
  }

  async removeVoiceRole(guildId, voiceRoleId) {
    const g = await this._guild(guildId);
    const idx = g.voiceRoles.findIndex((vr) => vr.id === voiceRoleId);
    if (idx === -1) return false;
    g.voiceRoles.splice(idx, 1);
    this.scheduleSave();
    return true;
  }

  async getSettings(guildId) {
    const g = await this._guild(guildId);
    return { ...g.settings };
  }

  async updateSettings(guildId, updates) {
    const g = await this._guild(guildId);
    g.settings = { ...g.settings, ...(updates || {}) };
    this.scheduleSave();
    return { ...g.settings };
  }

  async isPremium(guildId) {
    const g = await this._guild(guildId);
    return Boolean(g.settings.isPremium);
  }
}

module.exports = new TempVcStorage();
module.exports.TempVcStorage = TempVcStorage;
