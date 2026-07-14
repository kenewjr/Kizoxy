const {
  extractFixedLinks,
} = require("../../src/features/fixembed/fixembedResolver");

describe("FixEmbed Feature Tests", () => {
  it("extracts and rewrites Twitter and X.com links correctly", async () => {
    const content =
      "Check this out: https://twitter.com/username/status/1234567890";
    const results = await extractFixedLinks(content);
    expect(results.length).toBe(1);
    expect(results[0].platform).toBe("Twitter");
    expect(results[0].fixed).toContain("fxtwitter.com");
  });

  it("extracts and rewrites Instagram links correctly", async () => {
    const content = "Check this: https://www.instagram.com/p/C_abc123/";
    const results = await extractFixedLinks(content);
    expect(results.length).toBe(1);
    expect(results[0].platform).toBe("Instagram");
    expect(results[0].fixed).toContain("fxstagram.com");
  });

  it("respects platformsSettings exclusions", async () => {
    const content = "Check this: https://www.instagram.com/p/C_abc123/";
    const results = await extractFixedLinks(content, "normal", {
      instagram: false,
    });
    expect(results.length).toBe(0);
  });

  it("detects if link is wrapped inside a spoiler tag", async () => {
    const content =
      "Secret link: ||https://twitter.com/username/status/1234567890||";
    const results = await extractFixedLinks(content);
    expect(results.length).toBe(1);
    expect(results[0].spoiler).toBe(true);
  });
});
