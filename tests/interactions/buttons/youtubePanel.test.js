const {
  createMockButtonInteraction,
  createMockClient,
} = require("../../helpers/mockFactory");
const youtubePanel = require("../../../src/interactions/buttons/youtube_panel");
const actions = require("../../../src/integrations/youtube/panelActions");
const youtubeStorage = require("../../../src/persistence/youtubeStorage");
const panelBuilder = require("../../../src/integrations/youtube/panelBuilder");

jest.mock("../../../src/persistence/youtubeStorage", () => ({
  listSubscriptions: jest.fn().mockResolvedValue([]),
  getSubscription: jest.fn(),
  addSubscription: jest.fn(),
  updateSubscription: jest.fn(),
  removeSubscription: jest.fn(),
}));

jest.mock("../../../src/integrations/youtube/panelActions", () => ({
  handleAdd: jest.fn(),
  handleAddModal: jest.fn(),
  handleSetChannel: jest.fn(),
  handleChannelSelect: jest.fn(),
  handleToggleTypes: jest.fn(),
  handleNotifySelect: jest.fn(),
  handleCustomMsg: jest.fn(),
  handleCustomMsgModal: jest.fn(),
  handleClearMsg: jest.fn(),
  handleSave: jest.fn(),
  handleCancel: jest.fn(),
  handleSelectAction: jest.fn(),
  handleRemoveConfirm: jest.fn(),
  handlePage: jest.fn(),
  handleRefresh: jest.fn(),
}));

jest.mock("../../../src/integrations/youtube/panelBuilder", () => ({
  buildYtListEmbed: jest.fn().mockReturnValue({}),
  buildYtListRows: jest.fn().mockReturnValue([]),
}));

describe("YouTube Panel Button Interaction Tests", () => {
  let client, interaction;

  beforeEach(() => {
    client = createMockClient();
    interaction = createMockButtonInteraction("youtube_panel:add");
    interaction.guildId = "guild-123";
    interaction.memberPermissions = {
      has: () => true,
    };
    jest.clearAllMocks();
  });

  it("returns error if user does not have permission", async () => {
    interaction.memberPermissions.has = () => false;
    await youtubePanel.execute(interaction, client);
    expect(interaction.reply).toHaveBeenCalled();
    expect(
      interaction.reply.mock.calls[0][0].embeds[0].data.description,
    ).toContain("Manage Server");
  });

  it("routes all simple actions correctly", async () => {
    const cases = [
      ["add", actions.handleAdd],
      ["add_modal", actions.handleAddModal],
      ["set_channel", actions.handleSetChannel],
      ["channel_select", actions.handleChannelSelect],
      ["toggle_types", actions.handleToggleTypes],
      ["notify_select", actions.handleNotifySelect],
      ["custom_msg", actions.handleCustomMsg],
      ["custom_msg_modal", actions.handleCustomMsgModal],
      ["clear_msg", actions.handleClearMsg],
      ["save", actions.handleSave],
      ["cancel", actions.handleCancel],
      ["select_action", actions.handleSelectAction],
      ["remove_confirm", actions.handleRemoveConfirm],
      ["refresh", actions.handleRefresh],
    ];

    for (const [actionName, mockFunc] of cases) {
      interaction.customId = `youtube_panel:${actionName}`;
      await youtubePanel.execute(interaction, client);
      expect(mockFunc).toHaveBeenCalledWith(interaction, client);
    }
  });

  it("routes page action correctly", async () => {
    interaction.customId = "youtube_panel:page:2";
    await youtubePanel.execute(interaction, client);
    expect(actions.handlePage).toHaveBeenCalledWith(interaction, client, 2);
  });

  it("handles search_start modal", async () => {
    interaction.customId = "youtube_panel:search_start";
    interaction.showModal = jest.fn().mockResolvedValue({});
    await youtubePanel.execute(interaction, client);
    expect(interaction.showModal).toHaveBeenCalled();
  });

  it("handles search_clear", async () => {
    interaction.customId = "youtube_panel:search_clear";
    const key = `${interaction.user.id}:${interaction.guildId}`;
    youtubePanel.searchQueries.set(key, "query");

    await youtubePanel.execute(interaction, client);
    expect(actions.handleRefresh).toHaveBeenCalled();
    expect(youtubePanel.searchQueries.has(key)).toBe(false);
  });

  it("handles search_modal submission with query", async () => {
    interaction.customId = "youtube_panel:search_modal";
    interaction.fields = {
      getTextInputValue: jest.fn().mockReturnValue("lofi girl"),
    };
    youtubeStorage.listSubscriptions.mockResolvedValue([
      { youtubeChannelTitle: "Lofi Girl Channel", youtubeChannelId: "1" },
      { youtubeChannelTitle: "Other Channel", youtubeChannelId: "2" },
    ]);

    await youtubePanel.execute(interaction, client);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(youtubeStorage.listSubscriptions).toHaveBeenCalledWith("guild-123");
    expect(panelBuilder.buildYtListEmbed).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalled();
  });

  it("handles search_modal submission empty query", async () => {
    interaction.customId = "youtube_panel:search_modal";
    interaction.fields = {
      getTextInputValue: jest.fn().mockReturnValue(""),
    };
    youtubeStorage.listSubscriptions.mockResolvedValue([]);

    await youtubePanel.execute(interaction, client);
    expect(interaction.deferReply).toHaveBeenCalled();
  });
});
