const {
  createMockButtonInteraction,
  createMockClient,
} = require("../../helpers/mockFactory");
const fixembedPanel = require("../../../src/interactions/buttons/fixembed_panel");
const fixembedStorage = require("../../../src/persistence/fixembedStorage");

jest.mock("../../../src/persistence/fixembedStorage", () => {
  const actual = jest.requireActual("../../../src/persistence/fixembedStorage");
  return {
    ...actual,
    getSettings: jest.fn().mockReturnValue({
      enabled: true,
      deleteBehavior: "suppress",
      spoilerPassthrough: true,
      ignoredChannels: [],
      ignoredDomains: [],
      ignoredUsers: [],
      ignoredRoles: [],
      ignoredKeywords: [],
      platforms: {},
    }),
    setEnabled: jest.fn(),
    saveSettings: jest.fn(),
  };
});

describe("FixEmbed Panel Button Tests", () => {
  let client;

  beforeEach(() => {
    client = createMockClient();
    jest.clearAllMocks();
  });

  it("exports customId as fixembed_panel", () => {
    expect(fixembedPanel.customId).toBe("fixembed_panel");
  });

  it("shows main panel screen successfully", async () => {
    const interaction = createMockButtonInteraction("fixembed_panel:show_main");
    interaction.guildId = "guild-123";
    await fixembedPanel.showMain(interaction, client);
    expect(interaction.reply).toHaveBeenCalled();
  });

  it("toggles enabled status successfully", async () => {
    const interaction = createMockButtonInteraction(
      "fixembed_panel:toggle_enabled",
    );
    interaction.guildId = "guild-123";
    await fixembedPanel.execute(interaction, client);
    expect(fixembedStorage.setEnabled).toHaveBeenCalledWith("guild-123", false);
  });

  it("cycles delete behavior successfully", async () => {
    const interaction = createMockButtonInteraction(
      "fixembed_panel:toggle_behavior",
    );
    interaction.guildId = "guild-123";
    await fixembedPanel.execute(interaction, client);
    expect(fixembedStorage.saveSettings).toHaveBeenCalledWith("guild-123", {
      deleteBehavior: "delete",
    });
  });

  it("toggles spoiler passthrough successfully", async () => {
    const interaction = createMockButtonInteraction(
      "fixembed_panel:toggle_spoiler",
    );
    interaction.guildId = "guild-123";
    await fixembedPanel.execute(interaction, client);
    expect(fixembedStorage.saveSettings).toHaveBeenCalledWith("guild-123", {
      spoilerPassthrough: false,
    });
  });

  it("navigates to ignore screens", async () => {
    const interaction = createMockButtonInteraction(
      "fixembed_panel:view_ignores",
    );
    interaction.guildId = "guild-123";
    await fixembedPanel.execute(interaction, client);
    expect(interaction.reply).toHaveBeenCalled();
  });

  it("handles ignore list selection", async () => {
    const interaction = createMockButtonInteraction(
      "fixembed_panel:select_ignore_list",
    );
    interaction.guildId = "guild-123";
    interaction.values = ["channels"];
    await fixembedPanel.execute(interaction, client);
    expect(interaction.reply).toHaveBeenCalled();
  });

  it("adds channel to ignore list successfully", async () => {
    const interaction = createMockButtonInteraction(
      "fixembed_panel:add_channel",
    );
    interaction.guildId = "guild-123";
    interaction.values = ["444444444444444444"];
    await fixembedPanel.execute(interaction, client);
    expect(fixembedStorage.saveSettings).toHaveBeenCalled();
  });

  it("adds user to ignore list successfully", async () => {
    const interaction = createMockButtonInteraction("fixembed_panel:add_user");
    interaction.guildId = "guild-123";
    interaction.values = ["777777777777777777"];
    await fixembedPanel.execute(interaction, client);
    expect(fixembedStorage.saveSettings).toHaveBeenCalled();
  });

  it("adds role to ignore list successfully", async () => {
    const interaction = createMockButtonInteraction("fixembed_panel:add_role");
    interaction.guildId = "guild-123";
    interaction.values = ["888888888888888888"];
    await fixembedPanel.execute(interaction, client);
    expect(fixembedStorage.saveSettings).toHaveBeenCalled();
  });

  it("resets setting properties successfully", async () => {
    const interaction = createMockButtonInteraction("fixembed_panel:reset");
    interaction.guildId = "guild-123";
    await fixembedPanel.execute(interaction, client);
    expect(fixembedStorage.saveSettings).toHaveBeenCalledWith(
      "guild-123",
      expect.objectContaining({
        enabled: true,
        deleteBehavior: "suppress",
      }),
    );
  });

  it("removes channel, user, and role from ignores successfully", async () => {
    const interaction = createMockButtonInteraction(
      "fixembed_panel:remove_channel",
    );
    interaction.guildId = "guild-123";
    interaction.values = ["444444444444444444"];
    await fixembedPanel.execute(interaction, client);
    expect(fixembedStorage.saveSettings).toHaveBeenCalled();
  });

  it("shows domain and keyword add modals", async () => {
    const interaction = createMockButtonInteraction(
      "fixembed_panel:add_domain_btn",
    );
    interaction.guildId = "guild-123";
    interaction.showModal = jest.fn();
    await fixembedPanel.execute(interaction, client);
    expect(interaction.showModal).toHaveBeenCalled();
  });

  it("handles domain and keyword modal submission", async () => {
    const interaction = createMockButtonInteraction(
      "fixembed_panel:add_domain_modal",
    );
    interaction.guildId = "guild-123";
    interaction.fields = {
      getTextInputValue: () => "example.com",
    };
    await fixembedPanel.execute(interaction, client);
    expect(fixembedStorage.saveSettings).toHaveBeenCalled();
  });

  it("removes domain and keyword ignores successfully", async () => {
    const interaction = createMockButtonInteraction(
      "fixembed_panel:remove_domain",
    );
    interaction.guildId = "guild-123";
    interaction.values = ["example.com"];
    await fixembedPanel.execute(interaction, client);
    expect(fixembedStorage.saveSettings).toHaveBeenCalled();
  });

  it("navigates to platforms and selects group/platform detailed view", async () => {
    const interaction1 = createMockButtonInteraction(
      "fixembed_panel:view_platforms",
    );
    interaction1.guildId = "guild-123";
    await fixembedPanel.execute(interaction1, client);
    expect(interaction1.reply).toHaveBeenCalled();

    const interaction2 = createMockButtonInteraction(
      "fixembed_panel:select_platform_group",
    );
    interaction2.guildId = "guild-123";
    interaction2.values = ["social"];
    await fixembedPanel.execute(interaction2, client);
    expect(interaction2.reply).toHaveBeenCalled();

    const interaction3 = createMockButtonInteraction(
      "fixembed_panel:select_platform",
    );
    interaction3.guildId = "guild-123";
    interaction3.values = ["twitter"];
    await fixembedPanel.execute(interaction3, client);
    expect(interaction3.reply).toHaveBeenCalled();
  });

  it("toggles platform configuration and view mode", async () => {
    const interaction1 = createMockButtonInteraction(
      "fixembed_panel:toggle_platform:twitter",
    );
    interaction1.guildId = "guild-123";
    await fixembedPanel.execute(interaction1, client);
    expect(fixembedStorage.saveSettings).toHaveBeenCalled();

    const interaction2 = createMockButtonInteraction(
      "fixembed_panel:select_viewmode:twitter",
    );
    interaction2.guildId = "guild-123";
    interaction2.values = ["gallery"];
    await fixembedPanel.execute(interaction2, client);
    expect(fixembedStorage.saveSettings).toHaveBeenCalled();
  });

  it("handles back buttons correctly", async () => {
    const interaction1 = createMockButtonInteraction(
      "fixembed_panel:back_to_ignores",
    );
    interaction1.guildId = "guild-123";
    await fixembedPanel.execute(interaction1, client);
    expect(interaction1.reply).toHaveBeenCalled();

    const interaction2 = createMockButtonInteraction(
      "fixembed_panel:back_to_platforms",
    );
    interaction2.guildId = "guild-123";
    await fixembedPanel.execute(interaction2, client);
    expect(interaction2.reply).toHaveBeenCalled();

    const interaction3 = createMockButtonInteraction(
      "fixembed_panel:back_to_group:twitter",
    );
    interaction3.guildId = "guild-123";
    await fixembedPanel.execute(interaction3, client);
    expect(interaction3.reply).toHaveBeenCalled();
  });
});
