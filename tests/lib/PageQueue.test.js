const { NormalPage } = require("../../src/lib/PageQueue");
const {
  createMockInteraction,
  createMockClient,
} = require("../helpers/mockFactory");

describe("PageQueue Tests", () => {
  let client, message, pages;
  let collectorListeners;

  beforeEach(() => {
    client = createMockClient();
    message = createMockInteraction();
    pages = [
      {
        setFooter: jest.fn().mockReturnThis(),
      },
      {
        setFooter: jest.fn().mockReturnThis(),
      },
    ];

    collectorListeners = {};

    // Mock editReply and collector setup
    message.editReply = jest.fn().mockResolvedValue({
      id: "cur-page-123",
      createMessageComponentCollector: jest.fn().mockReturnValue({
        on: jest.fn().mockImplementation((event, cb) => {
          collectorListeners[event] = cb;
        }),
      }),
      edit: jest.fn(),
    });
  });

  it("throws error if message or pages is missing", async () => {
    await expect(
      NormalPage(client, null, pages, 60000, 1, 100),
    ).rejects.toThrow();
    await expect(
      NormalPage(client, message, null, 60000, 1, 100),
    ).rejects.toThrow();
  });

  it("successfully sets up pagination and collector", async () => {
    const res = await NormalPage(client, message, pages, 60000, 2, 200);
    expect(res).toBeDefined();
    expect(message.editReply).toHaveBeenCalled();
  });

  it("handles collector collect event (back and next)", async () => {
    const curPage = await NormalPage(client, message, pages, 60000, 2, 200);
    expect(collectorListeners["collect"]).toBeDefined();

    // Mock collect back
    const mockBackInteraction = {
      customId: "back",
      deferred: false,
      deferUpdate: jest.fn().mockResolvedValue(),
    };
    await collectorListeners["collect"](mockBackInteraction);
    expect(mockBackInteraction.deferUpdate).toHaveBeenCalled();
    expect(curPage.edit).toHaveBeenCalled();

    // Mock collect next
    const mockNextInteraction = {
      customId: "next",
      deferred: true,
      deferUpdate: jest.fn(),
    };
    await collectorListeners["collect"](mockNextInteraction);
    expect(mockNextInteraction.deferUpdate).not.toHaveBeenCalled();
    expect(curPage.edit).toHaveBeenCalled();
  });

  it("handles collector end event", async () => {
    const curPage = await NormalPage(client, message, pages, 60000, 2, 200);
    expect(collectorListeners["end"]).toBeDefined();

    collectorListeners["end"]();
    expect(curPage.edit).toHaveBeenCalled();
  });
});
