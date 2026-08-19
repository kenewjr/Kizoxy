const { InteractionType } = require("discord.js");
const interactionCreate = require("../../../src/events/guild/interactionCreate");

jest.mock("../../../src/lib/logger", () =>
  jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  })),
);

describe("play autocomplete", () => {
  it("keeps direct playlist URLs untouched", async () => {
    const search = jest.fn();
    const respond = jest.fn().mockResolvedValue();
    const playlistUrl =
      "https://www.youtube.com/playlist?list=PLKOOPiGZKb-GIMMlpBbhymbLrsNnwbdcB";
    const interaction = {
      type: InteractionType.ApplicationCommandAutocomplete,
      commandName: "play",
      guild: { id: "guild-1" },
      user: { bot: false },
      options: { getString: jest.fn().mockReturnValue(playlistUrl) },
      respond,
    };

    await interactionCreate({ manager: { search } }, interaction);

    expect(search).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith([]);
  });
});
