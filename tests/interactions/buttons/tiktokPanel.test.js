const {
  createMockButtonInteraction,
  createMockClient,
} = require("../../helpers/mockFactory");
const tiktokPanel = require("../../../src/interactions/buttons/tiktok_panel");
const actions = require("../../../src/integrations/tiktok/panelActions");

jest.mock("../../../src/persistence/tiktokStorage", () => ({
  listSubscriptions: jest.fn().mockResolvedValue([]),
  getSubscription: jest.fn(),
  addSubscription: jest.fn(),
  updateSubscription: jest.fn(),
  removeSubscription: jest.fn(),
}));

jest.mock("../../../src/integrations/tiktok/panelActions", () => ({
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
  handleStatus: jest.fn(),
  handleTest: jest.fn(),
  handleSearchStart: jest.fn(),
  handleSearchClear: jest.fn(),
  handleSearchModal: jest.fn(),
}));

describe("TikTok Panel Button Interaction Tests", () => {
  let client, interaction;

  beforeEach(() => {
    client = createMockClient();
    interaction = createMockButtonInteraction("tiktok_panel:add");
    interaction.guildId = "guild-123";
    interaction.memberPermissions = {
      has: () => true,
    };
    jest.clearAllMocks();
  });

  it("returns error if user does not have permission", async () => {
    interaction.memberPermissions.has = () => false;
    await tiktokPanel.execute(interaction, client);
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
      ["search_start", actions.handleSearchStart],
      ["search_clear", actions.handleSearchClear],
      ["search_modal", actions.handleSearchModal],
    ];

    for (const [actionName, mockFunc] of cases) {
      interaction.customId = `tiktok_panel:${actionName}`;
      await tiktokPanel.execute(interaction, client);
      expect(mockFunc).toHaveBeenCalledWith(interaction, client);
    }
  });

  it("routes page action correctly", async () => {
    interaction.customId = "tiktok_panel:page:3";
    await tiktokPanel.execute(interaction, client);
    expect(actions.handlePage).toHaveBeenCalledWith(interaction, client, 3);
  });

  it("routes status action correctly", async () => {
    interaction.customId = "tiktok_panel:status:profile-123";
    await tiktokPanel.execute(interaction, client);
    expect(actions.handleStatus).toHaveBeenCalledWith(
      interaction,
      client,
      "profile-123",
    );
  });

  it("routes test action correctly", async () => {
    interaction.customId = "tiktok_panel:test:profile-123";
    await tiktokPanel.execute(interaction, client);
    expect(actions.handleTest).toHaveBeenCalledWith(
      interaction,
      client,
      "profile-123",
    );
  });
});
