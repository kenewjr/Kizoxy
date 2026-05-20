// Tests for utils/helpers/fixembedSettingsHelper.js
const {
  ACTION_LABELS,
  VIEW_MODE_LABELS,
  fmt,
  buildMainPage,
  buildBehaviorPage,
  buildIgnorePage,
  navRow,
  actionSelectRow,
  viewSelectRow,
  channelSelectRow,
  userSelectRow,
  roleSelectRow,
  clearAllRow,
  ignorePage,
  behaviorPage,
} = require("../../utils/helpers/fixembedSettingsHelper");

const settings = {
  enabled: true,
  baseMessageAction: "remove_embed",
  viewMode: "normal",
  disabledChannels: ["111"],
  ignoredUsers: [],
  ignoredRoles: ["222"],
  ignoredKeywords: ["spam"],
};

const guild = {
  name: "TestGuild",
  iconURL: () => "https://cdn.example.com/icon.png",
};

describe("fixembedSettingsHelper", () => {
  describe("label maps", () => {
    test("ACTION_LABELS covers all three actions", () => {
      expect(ACTION_LABELS.nothing).toBe("Nothing");
      expect(ACTION_LABELS.remove_embed).toBe("Remove Embed");
      expect(ACTION_LABELS.delete_message).toBe("Delete Message");
    });

    test("VIEW_MODE_LABELS covers all four modes", () => {
      expect(VIEW_MODE_LABELS.normal).toBe("Normal");
      expect(VIEW_MODE_LABELS.direct).toBe("Direct");
      expect(VIEW_MODE_LABELS.gallery).toBe("Gallery");
      expect(VIEW_MODE_LABELS.text).toBe("Text-only");
    });
  });

  describe("fmt", () => {
    test("renders mentions joined by commas", () => {
      expect(fmt(["1", "2"], (id) => `<#${id}>`)).toBe("<#1>, <#2>");
    });
    test("renders italic *None* for empty arrays", () => {
      expect(fmt([], (id) => `<#${id}>`)).toBe("*None*");
    });
  });

  describe("embed builders", () => {
    test("buildMainPage renders title with guild name", () => {
      const json = buildMainPage(settings, guild, 0xffffff).toJSON();
      expect(json.title).toContain("TestGuild");
      expect(json.fields.map((f) => f.name)).toEqual(
        expect.arrayContaining([
          "Status",
          "Base Message Action",
          "View Mode",
          "Ignored Channels",
          "Ignored Keywords",
        ]),
      );
    });

    test("buildBehaviorPage shows current action and view", () => {
      const json = buildBehaviorPage(settings, 0xffffff).toJSON();
      const fieldValues = json.fields.map((f) => f.value);
      expect(fieldValues).toContain("`remove_embed`");
      expect(fieldValues).toContain("`normal`");
    });

    test("buildIgnorePage lists ignored keywords as code spans", () => {
      const json = buildIgnorePage(settings, 0xffffff).toJSON();
      const keywordsField = json.fields.find(
        (f) => f.name === "🔑 Ignored Keywords",
      );
      expect(keywordsField.value).toBe("`spam`");
    });

    test("buildIgnorePage shows *None* when keyword list is empty", () => {
      const empty = { ...settings, ignoredKeywords: [] };
      const json = buildIgnorePage(empty, 0xffffff).toJSON();
      const keywordsField = json.fields.find(
        (f) => f.name === "🔑 Ignored Keywords",
      );
      expect(keywordsField.value).toBe("*None*");
    });
  });

  describe("component rows", () => {
    test("navRow disables the current page button", () => {
      const json = navRow("g1", "u1", "main").toJSON();
      const buttons = json.components;
      const main = buttons.find((b) => b.custom_id.includes("page_main"));
      expect(main.disabled).toBe(true);
    });

    test("actionSelectRow renders three options", () => {
      const json = actionSelectRow("g1", "u1", "remove_embed").toJSON();
      const select = json.components[0];
      expect(select.options).toHaveLength(3);
    });

    test("viewSelectRow renders four options", () => {
      const json = viewSelectRow("g1", "u1", "normal").toJSON();
      const select = json.components[0];
      expect(select.options).toHaveLength(4);
    });

    test("channel/user/role select rows have minValues=1, maxValues=1", () => {
      for (const row of [
        channelSelectRow("g1", "u1"),
        userSelectRow("g1", "u1"),
        roleSelectRow("g1", "u1"),
      ]) {
        const select = row.toJSON().components[0];
        expect(select.min_values).toBe(1);
        expect(select.max_values).toBe(1);
      }
    });

    test("clearAllRow has four danger buttons", () => {
      const json = clearAllRow("g1", "u1").toJSON();
      const buttons = json.components;
      expect(buttons).toHaveLength(4);
      // ButtonStyle.Danger is 4 in the discord.js enum
      buttons.forEach((b) => expect(b.style).toBe(4));
    });
  });

  describe("page assemblers", () => {
    test("ignorePage returns embeds and 5 component rows", () => {
      const result = ignorePage(settings, 0xffffff, "", "g1", "u1");
      expect(result.embeds).toHaveLength(1);
      expect(result.components).toHaveLength(5);
    });

    test("behaviorPage returns embeds and 3 component rows", () => {
      const result = behaviorPage(settings, 0xffffff, "", "g1", "u1");
      expect(result.embeds).toHaveLength(1);
      expect(result.components).toHaveLength(3);
    });
  });
});
