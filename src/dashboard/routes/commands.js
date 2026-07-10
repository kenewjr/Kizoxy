const router = require("express").Router();
const Logger = require("../../lib/logger");
const HelpCommand = require("../../commands/slash/misc/Help");
const commandStorage = require("../../persistence/commandStorage");

const logger = new Logger("DASHBOARD-API");

// GET /api/commands
router.get("/", async (req, res) => {
  try {
    const allCommandsMap = HelpCommand.collectCommands();
    const customizations = await commandStorage.getAllCustomizations();

    const list = [];
    for (const [category, cmds] of allCommandsMap.entries()) {
      for (const cmd of cmds) {
        const custom = customizations[cmd.name] || {};
        list.push({
          name: cmd.name,
          originalDescription: cmd.description,
          category: category,
          type: cmd.type,
          displayName: custom.displayName || cmd.name,
          description: custom.description || cmd.description,
          hasCustomization: !!(custom.displayName || custom.description),
        });
      }
    }

    res.json(list);
  } catch (err) {
    logger.error(`GET /api/commands: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch commands" });
  }
});

// PATCH /api/commands/:name
router.patch("/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const { displayName, description } = req.body;

    const allCommandsMap = HelpCommand.collectCommands();
    let exists = false;
    for (const cmds of allCommandsMap.values()) {
      if (cmds.some((c) => c.name === name)) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      return res.status(404).json({ error: `Command "${name}" not found` });
    }

    if (displayName !== undefined && displayName !== null) {
      if (typeof displayName !== "string" || displayName.trim().length === 0) {
        return res
          .status(400)
          .json({ error: "displayName must be a non-empty string" });
      }
      if (displayName.length > 32) {
        return res
          .status(400)
          .json({ error: "displayName must be at most 32 characters" });
      }
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== "string" || description.trim().length === 0) {
        return res
          .status(400)
          .json({ error: "description must be a non-empty string" });
      }
      if (description.length > 100) {
        return res
          .status(400)
          .json({ error: "description must be at most 100 characters" });
      }
    }

    const updated = await commandStorage.setCustomization(name, {
      displayName: displayName || null,
      description: description || null,
    });

    res.json({ name, ...updated });
  } catch (err) {
    logger.error(`PATCH /api/commands/${req.params.name}: ${err.message}`);
    res.status(500).json({ error: "Failed to update command customization" });
  }
});

// DELETE /api/commands/:name
router.delete("/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const deleted = await commandStorage.deleteCustomization(name);
    res.json({ name, deleted });
  } catch (err) {
    logger.error(`DELETE /api/commands/${req.params.name}: ${err.message}`);
    res.status(500).json({ error: "Failed to delete command customization" });
  }
});

module.exports = router;
