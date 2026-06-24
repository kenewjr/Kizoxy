const { backoffMs } = require("../src/integrations/tiktok/scheduler");
const { _normalize } = require("../src/integrations/tiktok/client");
const {
  TIKTOK_BACKOFF_BASE_MS,
  TIKTOK_BACKOFF_MAX_MS,
} = require("../src/config/constants");

describe("tiktok scheduler backoff", () => {
  test("no failures = no wait", () => {
    expect(backoffMs(0)).toBe(0);
  });

  test("grows exponentially from the base", () => {
    expect(backoffMs(1)).toBe(TIKTOK_BACKOFF_BASE_MS);
    expect(backoffMs(2)).toBe(TIKTOK_BACKOFF_BASE_MS * 2);
    expect(backoffMs(3)).toBe(TIKTOK_BACKOFF_BASE_MS * 4);
  });

  test("is capped at the max", () => {
    expect(backoffMs(50)).toBe(TIKTOK_BACKOFF_MAX_MS);
  });
});

describe("tiktok client normalization", () => {
  test("maps provider shape onto the internal contract", () => {
    const out = _normalize("creator", {
      user: {
        id: 42,
        username: "Creator",
        avatar: "a.png",
        live: true,
        liveId: 7,
      },
      videos: [
        {
          id: 100,
          url: "u1",
          cover: "c1",
          title: "t1",
          createTime: 123,
          isLive: false,
        },
        { id: 101 },
      ],
    });
    expect(out.user.id).toBe("42");
    expect(out.user.live).toBe(true);
    expect(out.user.liveId).toBe("7");
    expect(out.videos).toHaveLength(2);
    expect(out.videos[0].id).toBe("100");
    // Missing url falls back to a constructed watch URL.
    expect(out.videos[1].url).toContain("/@creator/video/101");
  });

  test("drops videos without an id and tolerates missing fields", () => {
    const out = _normalize("creator", {
      user: {},
      videos: [{ url: "no-id" }, { id: 5 }],
    });
    expect(out.videos).toHaveLength(1);
    expect(out.videos[0].id).toBe("5");
    expect(out.user.live).toBe(false);
    expect(out.user.username).toBe("creator");
  });

  test("handles a totally empty response", () => {
    const out = _normalize("creator", {});
    expect(out.videos).toEqual([]);
    expect(out.user.id).toBeNull();
  });

  test("maps TikWM scraper shape onto the internal contract", () => {
    const tikwmData = {
      code: 0,
      msg: "success",
      data: {
        videos: [
          {
            video_id: "7651447222449556767",
            title: "At least he got the last one 😅",
            create_time: 1782232293,
            cover: "https://p16-common-sign.tiktokcdn-eu.com/cover.jpeg",
            author: {
              id: "6614519312189947909",
              unique_id: "mrbeast",
              nickname: "MrBeast",
              avatar: "https://p19-common-sign.tiktokcdn-eu.com/avatar.webp",
            },
          },
        ],
      },
    };

    const out = _normalize("mrbeast", tikwmData);
    expect(out.user.id).toBe("6614519312189947909");
    expect(out.user.username).toBe("mrbeast");
    expect(out.user.avatar).toBe(
      "https://p19-common-sign.tiktokcdn-eu.com/avatar.webp",
    );
    expect(out.user.live).toBe(false);
    expect(out.videos).toHaveLength(1);
    expect(out.videos[0].id).toBe("7651447222449556767");
    expect(out.videos[0].title).toBe("At least he got the last one 😅");
    expect(out.videos[0].createTime).toBe(1782232293);
    expect(out.videos[0].url).toContain("/@mrbeast/video/7651447222449556767");
  });
});
