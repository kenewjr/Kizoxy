const {
  buildContent,
  renderTemplate,
} = require("../../src/lib/notificationTemplate");

describe("notificationTemplate", () => {
  test("renderTemplate substitutes known placeholders and blanks unknown", () => {
    expect(renderTemplate("{name} - {url}", { name: "Bob", url: "x" })).toBe(
      "Bob - x",
    );
    expect(renderTemplate("{missing}", {})).toBe("");
  });

  test("falls back to default prefix when no custom message", () => {
    expect(
      buildContent({
        customMessage: null,
        mentionRoleId: null,
        defaultPrefix: "New video!",
        vars: {},
      }),
    ).toBe("New video!");
  });

  test("prepends role ping to default prefix", () => {
    expect(
      buildContent({
        customMessage: "",
        mentionRoleId: "123",
        defaultPrefix: "New video!",
      }),
    ).toBe("<@&123> New video!");
  });

  test("custom message with {role} placeholder is honoured verbatim", () => {
    expect(
      buildContent({
        customMessage: "{role} hey {name} dropped {title}",
        mentionRoleId: "123",
        defaultPrefix: "ignored",
        vars: { name: "Bob", title: "Cool Vid" },
      }),
    ).toBe("<@&123> hey Bob dropped Cool Vid");
  });

  test("custom message without {role} still gets the ping prepended", () => {
    expect(
      buildContent({
        customMessage: "hey {name}",
        mentionRoleId: "999",
        defaultPrefix: "ignored",
        vars: { name: "Bob" },
      }),
    ).toBe("<@&999> hey Bob");
  });

  test("no mention role and custom message renders plain", () => {
    expect(
      buildContent({
        customMessage: "watch {url}",
        mentionRoleId: null,
        defaultPrefix: "ignored",
        vars: { url: "http://x" },
      }),
    ).toBe("watch http://x");
  });

  test("content is capped at 2000 chars", () => {
    const long = "a".repeat(3000);
    const out = buildContent({
      customMessage: long,
      mentionRoleId: null,
      defaultPrefix: "x",
    });
    expect(out.length).toBe(2000);
  });
});
