const {
  resolveProfile,
  RESOLVE_ERROR,
} = require("../src/integrations/tiktok/resolver");

describe("tiktok resolver", () => {
  test("full profile URL extracts normalized username", () => {
    const r = resolveProfile("https://www.tiktok.com/@CoolCreator");
    expect(r.username).toBe("coolcreator");
    expect(r.profileUrl).toBe("https://www.tiktok.com/@coolcreator");
  });

  test("URL with trailing path/query still resolves", () => {
    const r = resolveProfile("https://www.tiktok.com/@user.name/video/123?x=1");
    expect(r.username).toBe("user.name");
  });

  test("bare @handle resolves", () => {
    const r = resolveProfile("@SomeOne");
    expect(r.username).toBe("someone");
    expect(r.profileUrl).toBe("https://www.tiktok.com/@someone");
  });

  test("plain handle (no @) resolves", () => {
    const r = resolveProfile("plainhandle");
    expect(r.username).toBe("plainhandle");
  });

  test("short share link is rejected with a helpful message", () => {
    expect(() => resolveProfile("https://vt.tiktok.com/ZSabc123/")).toThrow(
      /single video/i,
    );
  });

  test("empty input throws the friendly resolve error", () => {
    expect(() => resolveProfile("")).toThrow(RESOLVE_ERROR);
  });

  test("garbage URL throws the friendly resolve error", () => {
    expect(() => resolveProfile("https://example.com/foo/bar")).toThrow(
      RESOLVE_ERROR,
    );
  });
});
