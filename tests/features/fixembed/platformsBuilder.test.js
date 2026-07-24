const { createMockClient } = require("../../helpers/mockFactory");
const {
  buildPlatformsMainEmbed,
  buildPlatformsMainComponents,
  buildPlatformsGroupEmbed,
  buildPlatformsGroupComponents,
  buildPlatformDetailEmbed,
  buildPlatformDetailComponents,
} = require("../../../src/features/fixembed/panelBuilders/platformsBuilder");

jest.mock("../../../src/persistence/fixembedStorage", () => ({
  getSettings: jest.fn().mockReturnValue({
    platforms: {
      twitter: { enabled: true, viewMode: "normal" },
      instagram: { enabled: false, viewMode: "gallery" },
    },
  }),
}));

describe("platformsBuilder Tests", () => {
  let client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("builds platforms main screens correctly", () => {
    const embed = buildPlatformsMainEmbed(client, "guild-1");
    expect(embed).toBeDefined();

    const comps = buildPlatformsMainComponents();
    expect(comps.length).toBe(1);
  });

  it("builds platforms group screen correctly", () => {
    const embed = buildPlatformsGroupEmbed(client, "guild-1", "social");
    expect(embed).toBeDefined();

    const comps = buildPlatformsGroupComponents("guild-1", "social");
    expect(comps.length).toBe(2);
  });

  it("builds platforms detail screens with view modes support", () => {
    // 1. With view modes (twitter)
    const embed1 = buildPlatformDetailEmbed(client, "guild-1", "twitter");
    expect(embed1).toBeDefined();

    const comps1 = buildPlatformDetailComponents("guild-1", "twitter");
    expect(comps1.length).toBe(2);

    // 2. Without view modes (reddit)
    const embed2 = buildPlatformDetailEmbed(client, "guild-1", "reddit");
    expect(embed2).toBeDefined();

    const comps2 = buildPlatformDetailComponents("guild-1", "reddit");
    expect(comps2.length).toBe(2);
  });
});
