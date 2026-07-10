const JSONStorage = require("./jsonStorage");

class CommandStorage extends JSONStorage {
  constructor() {
    super("command_customizations.json");
  }

  async getCustomization(name) {
    await this._ensureLoaded();
    return this.data[name] || null;
  }

  async setCustomization(name, { displayName, description }) {
    await this._ensureLoaded();
    this.data[name] = {
      displayName: displayName || null,
      description: description || null,
    };
    this.scheduleSave();
    return this.data[name];
  }

  async deleteCustomization(name) {
    await this._ensureLoaded();
    if (this.data[name]) {
      delete this.data[name];
      this.scheduleSave();
      return true;
    }
    return false;
  }

  async getAllCustomizations() {
    await this._ensureLoaded();
    return this.data;
  }
}

module.exports = new CommandStorage();
