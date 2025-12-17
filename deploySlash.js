// deploySlash.js - Version with cleanup
const { REST, Routes, ApplicationCommandOptionType } = require("discord.js");
const { TOKEN } = require("./settings/config.js");
const fs = require("fs");
const path = require("path");

async function deploySlashCommands() {
  console.log("🚀 Starting slash command deployment...");

  // Parse arguments
  const args = process.argv.slice(2);
  const mode = args[0]; // 'global', 'guild', or 'delete'
  const guildId = args[1]; // guild ID if mode 'guild' or 'delete'
  const clearExisting = args.includes("--clear-all") || args.includes("-c");

  // Validate arguments
  if (!mode || (mode !== "global" && mode !== "guild" && mode !== "delete")) {
    console.error("❌ Invalid mode. Use:");
    console.error("   node deploySlash.js global [--clear-all]");
    console.error("   node deploySlash.js guild <guildId> [--clear-all]");
    console.error("   node deploySlash.js delete <guildId>");
    process.exit(1);
  }

  if ((mode === "guild" || mode === "delete") && !guildId) {
    console.error(`❌ Guild ID is required for ${mode} mode.`);
    console.error(`Usage: node deploySlash.js ${mode} <guildId>`);
    process.exit(1);
  }

  console.log(`📌 Mode: ${mode}`);

  // Special handling for delete mode
  if (mode === "delete") {
    console.log(`🗑️ Deleting all commands for guild: ${guildId}`);
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    try {
        const client = await rest.get(Routes.user());
        await rest.put(Routes.applicationGuildCommands(client.id, guildId), { body: [] });
        console.log(`✅ Successfully deleted all commands for guild ${guildId}`);
    } catch (error) {
        console.error(`❌ Failed to delete commands: ${error.message}`);
    }
    return;
  }

  console.log(`🧹 Clear existing: ${clearExisting ? "YES" : "NO"}`);

  // Step 1: Get client info
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  let client;
  try {
    client = await rest.get(Routes.user());
    console.log(
      `👤 Logged in as: ${client.username}#${client.discriminator} (${client.id})`,
    );
  } catch (error) {
    console.error("❌ Failed to authenticate with Discord API:", error.message);
    process.exit(1);
  }

  // Step 2: Clean up existing commands if requested
  if (clearExisting) {
    await cleanupExistingCommands(client.id, mode, guildId);
  }

  // Step 3: Load and validate commands
  const commands = await loadAndValidateCommands();

  if (commands.length === 0) {
    console.log("⚠️ No valid commands to deploy.");
    return;
  }

  console.log(`📦 Ready to deploy ${commands.length} commands`);

  // Step 4: Deploy commands
  await deployCommands(client.id, commands, mode, guildId);

  // Step 5: Verify deployment
  await verifyDeployment(client.id, mode, guildId);
}

// ============================================
// FUNGSI CLEANUP EXISTING COMMANDS
// ============================================

async function cleanupExistingCommands(clientId, mode, guildId) {
  console.log("\n🧹 CLEANUP: Removing existing commands...");
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    // Clean global commands (regardless of mode)
    console.log("🌍 Cleaning global commands...");
    const globalCommands = await rest.get(Routes.applicationCommands(clientId));

    if (globalCommands.length > 0) {
      console.log(`   Found ${globalCommands.length} global commands`);

      // Delete all global commands
      await rest.put(Routes.applicationCommands(clientId), { body: [] });
      console.log("   ✅ All global commands removed");

      // Alternative: Delete one by one (more reliable)
      /*
      for (const cmd of globalCommands) {
        try {
          await rest.delete(Routes.applicationCommand(clientId, cmd.id));
          console.log(`   Deleted: ${cmd.name} (${cmd.id})`);
        } catch (error) {
          console.log(`   Failed to delete ${cmd.name}: ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      */
    } else {
      console.log("   No global commands found");
    }

    // Clean guild commands if in guild mode
    if (mode === "guild") {
      console.log(`🎯 Cleaning guild commands for ${guildId}...`);
      try {
        const guildCommands = await rest.get(
          Routes.applicationGuildCommands(clientId, guildId),
        );

        if (guildCommands.length > 0) {
          console.log(`   Found ${guildCommands.length} guild commands`);

          // Delete all guild commands
          await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: [],
          });
          console.log("   ✅ All guild commands removed");
        } else {
          console.log("   No guild commands found");
        }
      } catch (error) {
        console.log(`   Could not fetch guild commands: ${error.message}`);
      }
    }

    // Wait for cleanup to propagate
    console.log("⏳ Waiting 3 seconds for cleanup to complete...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } catch (error) {
    console.error("❌ Cleanup failed:", error.message);
  }
}

// ============================================
// FUNGSI LOAD COMMANDS
// ============================================

async function loadAndValidateCommands() {
  const slashCommandsPath = path.join(__dirname, "commands", "Slash");

  if (!fs.existsSync(slashCommandsPath)) {
    console.error("❌ Slash commands folder not found.");
    process.exit(1);
  }

  console.log(`\n📂 Loading commands from: ${slashCommandsPath}`);

  let rawCommands = [];

  // Read all command files recursively
  function readCommandFiles(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        readCommandFiles(fullPath);
      } else if (file.endsWith(".js") && !file.startsWith("-")) {
        try {
          // Clear require cache
          delete require.cache[require.resolve(fullPath)];
          const cmd = require(fullPath);

          // Validate command structure
          if (!cmd.name || !Array.isArray(cmd.name)) {
            console.warn(`   ⚠️ Skipping ${file}: Invalid name format`);
            continue;
          }

          if (!cmd.description) {
            console.warn(`   ⚠️ Skipping ${file}: Missing description`);
            continue;
          }

          rawCommands.push({
            file: file,
            path: fullPath,
            data: cmd,
          });
        } catch (error) {
          console.error(`   ❌ Error loading ${file}: ${error.message}`);
        }
      }
    }
  }

  readCommandFiles(slashCommandsPath);
  console.log(`📊 Found ${rawCommands.length} valid command files`);

  // Group commands by main name
  const commandGroups = new Map();

  for (const { data: cmd } of rawCommands) {
    const mainName = cmd.name[0];

    if (!commandGroups.has(mainName)) {
      commandGroups.set(mainName, []);
    }

    commandGroups.get(mainName).push(cmd);
  }

  console.log(`📦 Grouped into ${commandGroups.size} command groups`);

  // Build Discord API command structure
  const discordCommands = [];

  for (const [mainName, commands] of commandGroups) {
    const discordCommand = buildCommand(mainName, commands);
    if (discordCommand) {
      discordCommands.push(discordCommand);
    }
  }

  return discordCommands;
}

function buildCommand(mainName, commands) {
  // Find command types
  const mainCommands = commands.filter((cmd) => cmd.name.length === 1);
  const subCommands = commands.filter((cmd) => cmd.name.length === 2);
  const groupCommands = commands.filter((cmd) => cmd.name.length === 3);

  // Case 1: Single command (e.g., ["play"])
  if (
    mainCommands.length > 0 &&
    subCommands.length === 0 &&
    groupCommands.length === 0
  ) {
    const cmd = mainCommands[0];
    return {
      type: cmd.type || 1,
      name: cmd.name[0],
      description: cmd.description,
      options: cleanOptions(cmd.options || []),
      default_permission: cmd.defaultPermission !== false,
    };
  }

  // Case 2: Command with subcommands (e.g., ["music", "play"], ["music", "pause"])
  if (subCommands.length > 0 || groupCommands.length > 0) {
    const commandData = {
      type: 1,
      name: mainName,
      description: `${mainName} commands`,
      options: [],
      default_permission: true,
    };

    // Add subcommands
    for (const subCmd of subCommands) {
      commandData.options.push({
        type: ApplicationCommandOptionType.Subcommand,
        name: subCmd.name[1],
        description: subCmd.description,
        options: cleanOptions(subCmd.options || []),
      });
    }

    // Add subcommand groups
    const groups = new Map();

    for (const groupCmd of groupCommands) {
      const groupName = groupCmd.name[1];
      const subCmdName = groupCmd.name[2];

      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }

      groups.get(groupName).push({
        name: subCmdName,
        description: groupCmd.description,
        options: cleanOptions(groupCmd.options || []),
      });
    }

    // Convert groups to proper structure
    for (const [groupName, subCmds] of groups) {
      commandData.options.push({
        type: ApplicationCommandOptionType.SubcommandGroup,
        name: groupName,
        description: `${groupName} commands`,
        options: subCmds.map((cmd) => ({
          type: ApplicationCommandOptionType.Subcommand,
          name: cmd.name,
          description: cmd.description,
          options: cmd.options,
        })),
      });
    }

    return commandData;
  }

  console.warn(`⚠️ No valid commands found for group: ${mainName}`);
  return null;
}

function cleanOptions(options) {
  if (!Array.isArray(options)) return [];

  return options.map((opt) => {
    const cleaned = {
      type: opt.type,
      name: opt.name,
      description: opt.description || "No description provided",
    };

    // Only include optional fields if they exist
    const optionalFields = [
      "required",
      "choices",
      "options",
      "min_value",
      "max_value",
      "min_length",
      "max_length",
      "autocomplete",
      "channel_types",
    ];

    optionalFields.forEach((field) => {
      if (opt[field] !== undefined) {
        cleaned[field] = opt[field];
      }
    });

    // Recursively clean nested options
    if (cleaned.options) {
      cleaned.options = cleanOptions(cleaned.options);
    }

    return cleaned;
  });
}

// ============================================
// FUNGSI DEPLOY COMMANDS
// ============================================

async function deployCommands(clientId, commands, mode, guildId) {
  console.log("\n🚀 DEPLOYING COMMANDS...");

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  // Show what we're deploying
  console.log(`📋 Commands to deploy (${commands.length}):`);
  commands.forEach((cmd, index) => {
    const optionCount = cmd.options?.length || 0;
    console.log(
      `  ${index + 1}. /${cmd.name} - ${cmd.description} (${optionCount} options)`,
    );
  });

  try {
    if (mode === "global") {
      console.log("🌍 Deploying globally...");

      const result = await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });

      console.log(
        `✅ Successfully deployed ${result.length} commands globally`,
      );
    } else if (mode === "guild") {
      console.log(`🎯 Deploying to guild ${guildId}...`);

      const result = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );

      console.log(
        `✅ Successfully deployed ${result.length} commands to guild ${guildId}`,
      );
    }
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);

    // Try batch deployment if single deployment fails
    if (commands.length > 1) {
      console.log("🔄 Trying batch deployment...");
      await deployInBatches(clientId, commands, mode, guildId);
    } else {
      process.exit(1);
    }
  }
}

async function deployInBatches(clientId, commands, mode, guildId) {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const batchSize = 5;
  let successful = 0;

  for (let i = 0; i < commands.length; i += batchSize) {
    const batch = commands.slice(i, i + batchSize);
    console.log(
      `\n📦 Batch ${Math.floor(i / batchSize) + 1} (${batch.length} commands)...`,
    );

    try {
      if (mode === "global") {
        await rest.put(Routes.applicationCommands(clientId), { body: batch });
      } else {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
          body: batch,
        });
      }

      successful += batch.length;
      console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} deployed`);

      // Rate limit delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (batchError) {
      console.error(
        `❌ Batch ${Math.floor(i / batchSize) + 1} failed: ${batchError.message}`,
      );

      // Try deploying individually
      for (const cmd of batch) {
        try {
          if (mode === "global") {
            await rest.put(Routes.applicationCommands(clientId), {
              body: [cmd],
            });
          } else {
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
              body: [cmd],
            });
          }
          successful++;
          console.log(`   ✅ /${cmd.name} deployed individually`);
        } catch (cmdError) {
          console.log(`   ❌ /${cmd.name} failed: ${cmdError.message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  console.log(
    `\n📊 Batch deployment complete: ${successful}/${commands.length} commands deployed`,
  );
}

// ============================================
// FUNGSI VERIFY DEPLOYMENT
// ============================================

async function verifyDeployment(clientId, mode, guildId) {
  console.log("\n🔍 VERIFYING DEPLOYMENT...");

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    let deployedCommands;

    if (mode === "global") {
      deployedCommands = await rest.get(Routes.applicationCommands(clientId));
      console.log(
        `🌍 Found ${deployedCommands.length} global commands on Discord`,
      );
    } else {
      deployedCommands = await rest.get(
        Routes.applicationGuildCommands(clientId, guildId),
      );
      console.log(
        `🎯 Found ${deployedCommands.length} guild commands on Discord`,
      );
    }

    // Show deployed commands
    deployedCommands.forEach((cmd, index) => {
      const optionsText = cmd.options ? ` (${cmd.options.length} options)` : "";
      console.log(`  ${index + 1}. /${cmd.name}${optionsText}`);
    });

    console.log("\n✅ DEPLOYMENT COMPLETE!");

    // Show timing info
    if (mode === "global") {
      console.log(
        "⏰ Global commands may take up to 1 hour to appear everywhere",
      );
      console.log("💡 Tip: Kick and re-invite bot for immediate update");
    } else {
      console.log("⏰ Guild commands should appear within a few seconds");
    }
  } catch (error) {
    console.log("⚠️ Could not verify deployment:", error.message);
  }
}

// ============================================
// RUN THE SCRIPT
// ============================================

deploySlashCommands().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
