const { createMockClient } = require("../../helpers/mockFactory");
const tempvcPanel = require("../../../src/interactions/buttons/tempvc_panel");
const tempVcStorage = require("../../../src/persistence/tempVcStorage");
const { ChannelType } = require("discord.js");

const originalCreateMockButtonInteraction =
  require("../../helpers/mockFactory").createMockButtonInteraction;
const createMockButtonInteraction = (customId, overrides = {}) => {
  return originalCreateMockButtonInteraction(customId, {
    deferUpdate: jest.fn().mockResolvedValue({}),
    guildId: "guild-123",
    ...overrides,
  });
};

jest.mock("../../../src/persistence/tempVcStorage", () => {
  const actual = jest.requireActual("../../../src/persistence/tempVcStorage");
  return {
    ...actual,
    getSettings: jest.fn().mockResolvedValue({
      maxGenerators: 2,
      maxTemplates: 3,
      maxVoiceRoles: 1,
      isPremium: false,
    }),
    getAllGenerators: jest.fn().mockResolvedValue([]),
    getGenerator: jest.fn().mockResolvedValue(null),
    addGenerator: jest.fn().mockResolvedValue({}),
    updateGenerator: jest.fn().mockResolvedValue({}),
    removeGenerator: jest.fn().mockResolvedValue(true),
    getAllTemplates: jest.fn().mockResolvedValue([]),
    getTemplate: jest.fn().mockResolvedValue(null),
    addTemplate: jest.fn().mockResolvedValue({}),
    updateTemplate: jest.fn().mockResolvedValue({}),
    removeTemplate: jest.fn().mockResolvedValue(true),
    getVoiceRoles: jest.fn().mockResolvedValue([]),
    addVoiceRole: jest.fn().mockResolvedValue({}),
    removeVoiceRole: jest.fn().mockResolvedValue(true),
    getTempChannel: jest.fn().mockResolvedValue(null),
  };
});

describe("TempVC Configuration Panel Tests", () => {
  let client;

  beforeEach(() => {
    client = createMockClient();
    jest.clearAllMocks();
    tempvcPanel.pendingConfigs.clear();
  });

  it("exports customId as tempvc_panel", () => {
    expect(tempvcPanel.customId).toBe("tempvc_panel");
  });

  it("shows main menu successfully", async () => {
    const interaction = createMockButtonInteraction("tempvc_panel:main");
    await tempvcPanel.execute(interaction, client);
    expect(interaction.reply).toHaveBeenCalled();
  });

  it("shows main menu editReply when deferred", async () => {
    const interaction = createMockButtonInteraction("tempvc_panel:main");
    interaction.deferred = true;
    await tempvcPanel.execute(interaction, client);
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("checks ManageGuild permission check", async () => {
    const interaction = createMockButtonInteraction("tempvc_panel:main");
    interaction.memberPermissions = { has: () => false };
    await tempvcPanel.execute(interaction, client);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining("Manage Server"),
            }),
          }),
        ],
      }),
    );
  });

  describe("Generators Screen", () => {
    it("navigates to generators list screen", async () => {
      const interaction = createMockButtonInteraction(
        "tempvc_panel:generators",
      );
      await tempvcPanel.execute(interaction, client);
      expect(interaction.reply).toHaveBeenCalled();
    });

    it("launches generator add channel select flow without deferring", async () => {
      const interaction = createMockButtonInteraction(
        "tempvc_panel:gen_add_flow",
      );
      await tempvcPanel.execute(interaction, client);
      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalled();
    });

    it("validates and configures generator channel correctly", async () => {
      const interaction = createMockButtonInteraction(
        "tempvc_panel:gen_select_channel",
      );
      interaction.values = ["555555555555555555"];

      const voiceChannel = {
        id: "555555555555555555",
        type: ChannelType.GuildVoice,
        parentId: "111111111111",
        bitrate: 64000,
      };

      interaction.guild = {
        channels: {
          fetch: jest.fn().mockResolvedValue(voiceChannel),
        },
      };

      await tempvcPanel.execute(interaction, client);
      expect(
        tempvcPanel.pendingConfigs.has(
          `${interaction.user.id}:${interaction.guildId}`,
        ),
      ).toBe(true);
    });

    it("handles generator validations (already generator / active VC)", async () => {
      const voiceChannel = {
        id: "555555555555555555",
        type: ChannelType.GuildVoice,
      };
      const guildMock = {
        channels: { fetch: jest.fn().mockResolvedValue(voiceChannel) },
      };

      const interaction1 = createMockButtonInteraction(
        "tempvc_panel:gen_select_channel",
      );
      interaction1.values = ["555555555555555555"];
      interaction1.guild = guildMock;
      tempVcStorage.getTempChannel.mockResolvedValueOnce({});
      await tempvcPanel.execute(interaction1, client);
      expect(interaction1.reply).toHaveBeenCalled();

      const interaction2 = createMockButtonInteraction(
        "tempvc_panel:gen_select_channel",
      );
      interaction2.values = ["555555555555555555"];
      interaction2.guild = guildMock;
      tempVcStorage.getGenerator.mockResolvedValueOnce({});
      await tempvcPanel.execute(interaction2, client);
      expect(interaction2.reply).toHaveBeenCalled();

      // Invalid channel fetch
      const interaction3 = createMockButtonInteraction(
        "tempvc_panel:gen_select_channel",
      );
      interaction3.values = ["555555555555555555"];
      interaction3.guild = {
        channels: { fetch: jest.fn().mockResolvedValue(null) },
      };
      await tempvcPanel.execute(interaction3, client);
      expect(interaction3.reply).toHaveBeenCalled();
    });

    it("handles generator additions when limit reached", async () => {
      const voiceChannel = {
        id: "555555555555555555",
        type: ChannelType.GuildVoice,
      };
      const guildMock = {
        channels: { fetch: jest.fn().mockResolvedValue(voiceChannel) },
      };

      const interaction = createMockButtonInteraction(
        "tempvc_panel:gen_select_channel",
      );
      interaction.values = ["555555555555555555"];
      interaction.guild = guildMock;
      tempVcStorage.getAllGenerators.mockResolvedValueOnce([{}, {}]);
      await tempvcPanel.execute(interaction, client);
      expect(interaction.reply).toHaveBeenCalled();
    });

    it("updates generator category successfully", async () => {
      const key = `777777777777777777:guild-123`;
      tempvcPanel.pendingConfigs.set(key, {
        screen: "generator_config",
        mode: "add",
        data: {
          id: "555555555555555555",
          categoryId: null,
          defaultName: "VC",
          defaultLimit: 0,
          bitrate: 64,
        },
        expiresAt: Date.now() + 100000,
      });

      const interaction1 = createMockButtonInteraction(
        "tempvc_panel:gen_set_category_btn",
      );
      await tempvcPanel.execute(interaction1, client);
      expect(interaction1.reply).toHaveBeenCalled();

      const interaction2 = createMockButtonInteraction(
        "tempvc_panel:gen_select_category",
      );
      interaction2.values = ["999999999999"];
      await tempvcPanel.execute(interaction2, client);
      expect(tempvcPanel.pendingConfigs.get(key).data.categoryId).toBe(
        "999999999999",
      );
    });

    it("saves generator settings and cancels correctly", async () => {
      const key = `777777777777777777:guild-123`;
      tempvcPanel.pendingConfigs.set(key, {
        screen: "generator_config",
        mode: "add",
        data: {
          id: "555555555555555555",
          categoryId: null,
          defaultName: "VC",
          defaultLimit: 0,
          bitrate: 64,
        },
        expiresAt: Date.now() + 100000,
      });

      const interactionSave = createMockButtonInteraction(
        "tempvc_panel:gen_save",
      );
      await tempvcPanel.execute(interactionSave, client);
      expect(tempVcStorage.addGenerator).toHaveBeenCalled();

      tempvcPanel.pendingConfigs.set(key, {
        screen: "generator_config",
        mode: "add",
        data: {},
        expiresAt: Date.now() + 100000,
      });
      const interactionCancel = createMockButtonInteraction(
        "tempvc_panel:gen_cancel",
      );
      await tempvcPanel.execute(interactionCancel, client);
      expect(tempvcPanel.pendingConfigs.has(key)).toBe(false);
    });

    it("sets generator modals and fields", async () => {
      const key = `777777777777777777:guild-123`;
      const setupPending = () => {
        tempvcPanel.pendingConfigs.set(key, {
          screen: "generator_config",
          mode: "add",
          data: { defaultName: "VC", defaultLimit: 0, bitrate: 64 },
          expiresAt: Date.now() + 100000,
        });
      };

      setupPending();
      const interactionNameBtn = createMockButtonInteraction(
        "tempvc_panel:gen_set_name_btn",
      );
      await tempvcPanel.execute(interactionNameBtn, client);
      expect(interactionNameBtn.showModal).toHaveBeenCalled();

      const interactionNameModal = createMockButtonInteraction(
        "tempvc_panel:gen_set_name_modal",
      );
      interactionNameModal.fields = {
        getTextInputValue: () => "New Name Pattern",
      };
      await tempvcPanel.execute(interactionNameModal, client);
      expect(tempvcPanel.pendingConfigs.get(key).data.defaultName).toBe(
        "New Name Pattern",
      );

      setupPending();
      const interactionLimitBtn = createMockButtonInteraction(
        "tempvc_panel:gen_set_limit_btn",
      );
      await tempvcPanel.execute(interactionLimitBtn, client);
      expect(interactionLimitBtn.showModal).toHaveBeenCalled();

      const interactionLimitModal = createMockButtonInteraction(
        "tempvc_panel:gen_set_limit_modal",
      );
      interactionLimitModal.fields = { getTextInputValue: () => "10" };
      await tempvcPanel.execute(interactionLimitModal, client);
      expect(tempvcPanel.pendingConfigs.get(key).data.defaultLimit).toBe(10);

      // Invalid limit check
      setupPending();
      const interactionLimitModalInvalid = createMockButtonInteraction(
        "tempvc_panel:gen_set_limit_modal",
      );
      interactionLimitModalInvalid.fields = { getTextInputValue: () => "150" };
      await tempvcPanel.execute(interactionLimitModalInvalid, client);
      expect(interactionLimitModalInvalid.reply).toHaveBeenCalled();

      setupPending();
      const interactionBitrateBtn = createMockButtonInteraction(
        "tempvc_panel:gen_set_bitrate_btn",
      );
      await tempvcPanel.execute(interactionBitrateBtn, client);
      expect(interactionBitrateBtn.showModal).toHaveBeenCalled();

      const interactionBitrateModal = createMockButtonInteraction(
        "tempvc_panel:gen_set_bitrate_modal",
      );
      interactionBitrateModal.fields = { getTextInputValue: () => "96" };
      await tempvcPanel.execute(interactionBitrateModal, client);
      expect(tempvcPanel.pendingConfigs.get(key).data.bitrate).toBe(96);

      // Invalid bitrate check
      setupPending();
      const interactionBitrateModalInvalid = createMockButtonInteraction(
        "tempvc_panel:gen_set_bitrate_modal",
      );
      interactionBitrateModalInvalid.fields = {
        getTextInputValue: () => "500",
      };
      await tempvcPanel.execute(interactionBitrateModalInvalid, client);
      expect(interactionBitrateModalInvalid.reply).toHaveBeenCalled();

      // Region controls
      setupPending();
      const interactionRegionBtn = createMockButtonInteraction(
        "tempvc_panel:gen_set_region_btn",
      );
      await tempvcPanel.execute(interactionRegionBtn, client);
      expect(interactionRegionBtn.reply).toHaveBeenCalled();

      const interactionRegionSelect = createMockButtonInteraction(
        "tempvc_panel:gen_select_region",
      );
      interactionRegionSelect.values = ["japan"];
      await tempvcPanel.execute(interactionRegionSelect, client);
      expect(tempvcPanel.pendingConfigs.get(key).data.rtcRegion).toBe("japan");

      // Template controls
      setupPending();
      const interactionTemplateBtn = createMockButtonInteraction(
        "tempvc_panel:gen_set_template_btn",
      );
      await tempvcPanel.execute(interactionTemplateBtn, client);
      expect(interactionTemplateBtn.reply).toHaveBeenCalled();

      const interactionTemplateSelect = createMockButtonInteraction(
        "tempvc_panel:gen_select_template",
      );
      interactionTemplateSelect.values = ["none"];
      await tempvcPanel.execute(interactionTemplateSelect, client);
      expect(tempvcPanel.pendingConfigs.get(key).data.templateId).toBeNull();
    });

    it("triggers generator selection and deletion flow", async () => {
      const interactionSelect = createMockButtonInteraction(
        "tempvc_panel:gen_select_to_edit",
      );
      interactionSelect.values = ["gen_edit:555555555555555555"];
      tempVcStorage.getGenerator.mockResolvedValueOnce({
        id: "555555555555555555",
      });
      await tempvcPanel.execute(interactionSelect, client);
      expect(interactionSelect.reply).toHaveBeenCalled();

      // Edit generator not found
      const interactionSelectFail = createMockButtonInteraction(
        "tempvc_panel:gen_select_to_edit",
      );
      interactionSelectFail.values = ["gen_edit:555555555555555555"];
      tempVcStorage.getGenerator.mockResolvedValueOnce(null);
      await tempvcPanel.execute(interactionSelectFail, client);
      expect(interactionSelectFail.reply).toHaveBeenCalled();

      const key = `777777777777777777:guild-123`;
      tempvcPanel.pendingConfigs.set(key, {
        screen: "generator_config",
        mode: "edit",
        editId: "555555555555555555",
        data: {},
        expiresAt: Date.now() + 100000,
      });

      const interactionDelBtn = createMockButtonInteraction(
        "tempvc_panel:gen_delete_btn",
      );
      await tempvcPanel.execute(interactionDelBtn, client);
      expect(interactionDelBtn.reply).toHaveBeenCalled();

      const interactionDelConfirm = createMockButtonInteraction(
        "tempvc_panel:gen_delete_confirm",
      );
      await tempvcPanel.execute(interactionDelConfirm, client);
      expect(tempVcStorage.removeGenerator).toHaveBeenCalledWith(
        "guild-123",
        "555555555555555555",
      );
    });
  });

  describe("Templates Screen", () => {
    it("navigates to templates list screen", async () => {
      const interaction = createMockButtonInteraction("tempvc_panel:templates");
      await tempvcPanel.execute(interaction, client);
      expect(interaction.reply).toHaveBeenCalled();
    });

    it("launches add template modal without deferring", async () => {
      const interaction = createMockButtonInteraction(
        "tempvc_panel:tpl_add_flow",
      );
      await tempvcPanel.execute(interaction, client);
      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(interaction.showModal).toHaveBeenCalled();
    });

    it("handles add template modal when limit reached", async () => {
      const interaction = createMockButtonInteraction(
        "tempvc_panel:tpl_add_flow",
      );
      tempVcStorage.getAllTemplates.mockResolvedValueOnce([{}, {}, {}]);
      await tempvcPanel.execute(interaction, client);
      expect(interaction.reply).toHaveBeenCalled();
    });

    it("handles add template modal submit", async () => {
      const interaction = createMockButtonInteraction(
        "tempvc_panel:tpl_add_modal",
      );
      interaction.fields = { getTextInputValue: () => "New Template" };
      await tempvcPanel.execute(interaction, client);
      expect(
        tempvcPanel.pendingConfigs.get(`777777777777777777:guild-123`).data
          .name,
      ).toBe("New Template");
    });

    it("sets template parameters via buttons and modals", async () => {
      const key = `777777777777777777:guild-123`;
      const setupPending = () => {
        tempvcPanel.pendingConfigs.set(key, {
          screen: "template_config",
          mode: "edit",
          editId: "tpl-123",
          data: {
            name: "Name",
            channelName: "VC",
            limit: 0,
            isLocked: false,
            isHidden: false,
          },
          expiresAt: Date.now() + 100000,
        });
      };

      setupPending();
      const interactionNameBtn = createMockButtonInteraction(
        "tempvc_panel:tpl_set_name_btn",
      );
      await tempvcPanel.execute(interactionNameBtn, client);
      expect(interactionNameBtn.showModal).toHaveBeenCalled();

      const interactionNameModal = createMockButtonInteraction(
        "tempvc_panel:tpl_set_name_modal",
      );
      interactionNameModal.fields = {
        getTextInputValue: () => "New Display Name",
      };
      await tempvcPanel.execute(interactionNameModal, client);
      expect(tempvcPanel.pendingConfigs.get(key).data.name).toBe(
        "New Display Name",
      );

      setupPending();
      const interactionChNameBtn = createMockButtonInteraction(
        "tempvc_panel:tpl_set_channel_name_btn",
      );
      await tempvcPanel.execute(interactionChNameBtn, client);
      expect(interactionChNameBtn.showModal).toHaveBeenCalled();

      const interactionChNameModal = createMockButtonInteraction(
        "tempvc_panel:tpl_set_channel_name_modal",
      );
      interactionChNameModal.fields = {
        getTextInputValue: () => "New Channel Name",
      };
      await tempvcPanel.execute(interactionChNameModal, client);
      expect(tempvcPanel.pendingConfigs.get(key).data.channelName).toBe(
        "New Channel Name",
      );

      setupPending();
      const interactionPatternBtn = createMockButtonInteraction(
        "tempvc_panel:tpl_set_pattern_btn",
      );
      await tempvcPanel.execute(interactionPatternBtn, client);
      expect(interactionPatternBtn.showModal).toHaveBeenCalled();

      const interactionPatternModal = createMockButtonInteraction(
        "tempvc_panel:tpl_set_pattern_modal",
      );
      interactionPatternModal.fields = {
        getTextInputValue: () => "New Pattern",
      };
      await tempvcPanel.execute(interactionPatternModal, client);
      expect(tempvcPanel.pendingConfigs.get(key).data.namePattern).toBe(
        "New Pattern",
      );

      setupPending();
      const interactionLimitBtn = createMockButtonInteraction(
        "tempvc_panel:tpl_set_limit_btn",
      );
      await tempvcPanel.execute(interactionLimitBtn, client);
      expect(interactionLimitBtn.showModal).toHaveBeenCalled();

      const interactionLimitModal = createMockButtonInteraction(
        "tempvc_panel:tpl_set_limit_modal",
      );
      interactionLimitModal.fields = { getTextInputValue: () => "5" };
      await tempvcPanel.execute(interactionLimitModal, client);
      expect(tempvcPanel.pendingConfigs.get(key).data.limit).toBe(5);

      // Invalid limit check
      setupPending();
      const interactionLimitModalInvalid = createMockButtonInteraction(
        "tempvc_panel:tpl_set_limit_modal",
      );
      interactionLimitModalInvalid.fields = { getTextInputValue: () => "150" };
      await tempvcPanel.execute(interactionLimitModalInvalid, client);
      expect(interactionLimitModalInvalid.reply).toHaveBeenCalled();

      setupPending();
      const interactionLocked = createMockButtonInteraction(
        "tempvc_panel:tpl_toggle_locked_btn",
      );
      await tempvcPanel.execute(interactionLocked, client);
      expect(tempvcPanel.pendingConfigs.get(key).data.isLocked).toBe(true);

      const interactionHidden = createMockButtonInteraction(
        "tempvc_panel:tpl_toggle_hidden_btn",
      );
      await tempvcPanel.execute(interactionHidden, client);
      expect(tempvcPanel.pendingConfigs.get(key).data.isHidden).toBe(true);
    });

    it("triggers template deletion flow", async () => {
      const interactionSelect = createMockButtonInteraction(
        "tempvc_panel:tpl_select_to_edit",
      );
      interactionSelect.values = ["tpl_edit:tpl-123"];
      tempVcStorage.getTemplate.mockResolvedValueOnce({ id: "tpl-123" });
      await tempvcPanel.execute(interactionSelect, client);
      expect(interactionSelect.reply).toHaveBeenCalled();

      // Edit template not found
      const interactionSelectFail = createMockButtonInteraction(
        "tempvc_panel:tpl_select_to_edit",
      );
      interactionSelectFail.values = ["tpl_edit:tpl-123"];
      tempVcStorage.getTemplate.mockResolvedValueOnce(null);
      await tempvcPanel.execute(interactionSelectFail, client);
      expect(interactionSelectFail.reply).toHaveBeenCalled();

      const key = `777777777777777777:guild-123`;
      tempvcPanel.pendingConfigs.set(key, {
        screen: "template_config",
        mode: "edit",
        editId: "tpl-123",
        data: { name: "Name" },
        expiresAt: Date.now() + 100000,
      });

      const interactionDelBtn = createMockButtonInteraction(
        "tempvc_panel:tpl_delete_btn",
      );
      await tempvcPanel.execute(interactionDelBtn, client);
      expect(interactionDelBtn.reply).toHaveBeenCalled();

      const interactionDelConfirm = createMockButtonInteraction(
        "tempvc_panel:tpl_delete_confirm",
      );
      await tempvcPanel.execute(interactionDelConfirm, client);
      expect(tempVcStorage.removeTemplate).toHaveBeenCalledWith(
        "guild-123",
        "tpl-123",
      );
    });
  });

  describe("Voice Roles Screen", () => {
    it("navigates to voice roles list screen", async () => {
      const interaction = createMockButtonInteraction(
        "tempvc_panel:voice_roles",
      );
      await tempvcPanel.execute(interaction, client);
      expect(interaction.reply).toHaveBeenCalled();
    });

    it("launches voice role add flow channel select without deferring", async () => {
      const interaction = createMockButtonInteraction(
        "tempvc_panel:vr_add_flow",
      );
      await tempvcPanel.execute(interaction, client);
      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalled();
    });

    it("handles voice role select limit reached", async () => {
      const interaction = createMockButtonInteraction(
        "tempvc_panel:vr_add_flow",
      );
      tempVcStorage.getVoiceRoles.mockResolvedValueOnce([{}]);
      await tempvcPanel.execute(interaction, client);
      expect(interaction.reply).toHaveBeenCalled();
    });

    it("handles voice role channel selection and validation", async () => {
      const interaction = createMockButtonInteraction(
        "tempvc_panel:vr_select_channel",
      );
      interaction.values = ["555555555555555555"];

      const voiceChannel = {
        id: "555555555555555555",
        type: ChannelType.GuildVoice,
      };

      interaction.guild = {
        channels: {
          fetch: jest.fn().mockResolvedValue(voiceChannel),
        },
      };

      await tempvcPanel.execute(interaction, client);
      expect(
        tempvcPanel.pendingConfigs.get(`777777777777777777:guild-123`).data
          .channelId,
      ).toBe("555555555555555555");
    });

    it("handles voice role channel validation failures", async () => {
      const interaction1 = createMockButtonInteraction(
        "tempvc_panel:vr_select_channel",
      );
      interaction1.values = ["555555555555555555"];
      interaction1.guild = {
        channels: { fetch: jest.fn().mockResolvedValue(null) },
      };
      await tempvcPanel.execute(interaction1, client);
      expect(interaction1.reply).toHaveBeenCalled();

      const interaction2 = createMockButtonInteraction(
        "tempvc_panel:vr_select_channel",
      );
      interaction2.values = ["555555555555555555"];
      interaction2.guild = {
        channels: {
          fetch: jest.fn().mockResolvedValue({ type: ChannelType.GuildText }),
        },
      };
      await tempvcPanel.execute(interaction2, client);
      expect(interaction2.reply).toHaveBeenCalled();
    });

    it("handles voice role selection and checks duplicate / high role / managed", async () => {
      const key = `777777777777777777:guild-123`;
      const setupPending = () => {
        tempvcPanel.pendingConfigs.set(key, {
          screen: "voice_role_config_role",
          mode: "add",
          data: { channelId: "555555555555555555", roleId: null },
          expiresAt: Date.now() + 100000,
        });
      };

      // Duplicate check
      setupPending();
      const interactionDuplicate = createMockButtonInteraction(
        "tempvc_panel:vr_select_role",
      );
      interactionDuplicate.values = ["888888888888888888"];
      tempVcStorage.getVoiceRoles.mockResolvedValueOnce([
        { channelId: "555555555555555555", roleId: "888888888888888888" },
      ]);
      await tempvcPanel.execute(interactionDuplicate, client);
      expect(interactionDuplicate.reply).toHaveBeenCalled();

      // Bot highest role position check
      setupPending();
      const interactionHigh = createMockButtonInteraction(
        "tempvc_panel:vr_select_role",
      );
      interactionHigh.values = ["888888888888888888"];
      interactionHigh.guild = {
        members: {
          me: { roles: { highest: { position: 10 } } },
        },
        roles: {
          fetch: jest.fn().mockResolvedValue({ position: 20 }),
        },
      };
      await tempvcPanel.execute(interactionHigh, client);
      expect(interactionHigh.reply).toHaveBeenCalled();

      // Managed role check
      setupPending();
      const interactionManaged = createMockButtonInteraction(
        "tempvc_panel:vr_select_role",
      );
      interactionManaged.values = ["888888888888888888"];
      interactionManaged.guild = {
        members: {
          me: { roles: { highest: { position: 30 } } },
        },
        roles: {
          fetch: jest.fn().mockResolvedValue({ position: 20, managed: true }),
        },
      };
      await tempvcPanel.execute(interactionManaged, client);
      expect(interactionManaged.reply).toHaveBeenCalled();
    });

    it("saves voice role connection correctly", async () => {
      const key = `777777777777777777:guild-123`;
      tempvcPanel.pendingConfigs.set(key, {
        screen: "voice_role_config",
        mode: "add",
        data: {
          channelId: "555555555555555555",
          roleId: "888888888888888888",
          ownerOnly: true,
        },
        expiresAt: Date.now() + 100000,
      });

      const interaction = createMockButtonInteraction("tempvc_panel:vr_save");
      await tempvcPanel.execute(interaction, client);

      expect(tempVcStorage.addVoiceRole).toHaveBeenCalled();
      expect(tempvcPanel.pendingConfigs.has(key)).toBe(false);
    });

    it("toggles voice role scope and handles removal", async () => {
      const key = `777777777777777777:guild-123`;
      tempvcPanel.pendingConfigs.set(key, {
        screen: "voice_role_config",
        mode: "add",
        data: {
          channelId: "555555555555555555",
          roleId: "888888888888888888",
          ownerOnly: true,
        },
        expiresAt: Date.now() + 100000,
      });

      const interactionToggle = createMockButtonInteraction(
        "tempvc_panel:vr_toggle_owner_btn",
      );
      await tempvcPanel.execute(interactionToggle, client);
      expect(tempvcPanel.pendingConfigs.get(key).data.ownerOnly).toBe(false);

      const interactionDelSelect = createMockButtonInteraction(
        "tempvc_panel:vr_select_to_remove",
      );
      interactionDelSelect.values = ["vr_remove:vr-id-123"];
      await tempvcPanel.execute(interactionDelSelect, client);
      expect(interactionDelSelect.reply).toHaveBeenCalled();

      const interactionDelConfirm = createMockButtonInteraction(
        "tempvc_panel:vr_remove_confirm:vr-id-123",
      );
      await tempvcPanel.execute(interactionDelConfirm, client);
      expect(tempVcStorage.removeVoiceRole).toHaveBeenCalledWith(
        "guild-123",
        "vr-id-123",
      );
    });
  });

  describe("Session management and limits", () => {
    it("notifies user when configuring with an expired session", async () => {
      const key = `777777777777777777:guild-123`;
      tempvcPanel.pendingConfigs.set(key, {
        screen: "generator_config",
        mode: "add",
        data: {},
        expiresAt: Date.now() - 1000, // Expired TTL
      });

      const interaction = createMockButtonInteraction("tempvc_panel:gen_save");
      await tempvcPanel.execute(interaction, client);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: [
            expect.objectContaining({
              data: expect.objectContaining({
                description: expect.stringContaining("session has expired"),
              }),
            }),
          ],
        }),
      );
    });

    it("keeps configuration states separate for two users", async () => {
      const key1 = `user1:guild-123`;
      const key2 = `user2:guild-123`;

      tempvcPanel.pendingConfigs.set(key1, {
        screen: "generator_config",
        mode: "add",
        data: { name: "User 1 Generator" },
        expiresAt: Date.now() + 100000,
      });

      tempvcPanel.pendingConfigs.set(key2, {
        screen: "generator_config",
        mode: "add",
        data: { name: "User 2 Generator" },
        expiresAt: Date.now() + 100000,
      });

      expect(tempvcPanel.pendingConfigs.get(key1).data.name).toBe(
        "User 1 Generator",
      );
      expect(tempvcPanel.pendingConfigs.get(key2).data.name).toBe(
        "User 2 Generator",
      );
    });
  });
});
