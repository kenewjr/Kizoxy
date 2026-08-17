const messageCreate = require("../../../src/events/guild/messageCreate");
const {
  createMockClient,
  createMockGuild,
  createMockMessage,
} = require("../../helpers/mockFactory");

jest.mock("../../../src/features/fixembed/fixembedMessageHandler", () => ({
  handleFixembedMessage: jest.fn().mockResolvedValue(),
}));

jest.mock("../../../src/features/level/messageXpHandler", () => ({
  handleMessageXp: jest.fn().mockResolvedValue(),
}));

describe("messageCreate Event Tests", () => {
  let client, guild, message;

  beforeEach(() => {
    client = createMockClient({
      prefix: "k",
    });
    guild = createMockGuild();
    message = createMockMessage({
      guild,
      content: "kplay song title",
      member: {
        permissions: {
          has: jest.fn().mockReturnValue(true),
        },
      },
    });
  });

  it("invokes command.run with (client, message, args, prefix) for valid command", async () => {
    const runMock = jest.fn().mockResolvedValue();
    const playCmd = {
      name: "play",
      run: runMock,
    };
    client.prefixCommands.set("play", playCmd);

    message.content = "kplay song title";
    await messageCreate(client, message);

    expect(runMock).toHaveBeenCalledTimes(1);
    expect(runMock).toHaveBeenCalledWith(
      client,
      message,
      ["song", "title"],
      "k",
    );
  });

  it("invokes command.exec with (client, message, args) when command uses exec", async () => {
    const execMock = jest.fn().mockResolvedValue();
    const execCmd = {
      name: "custom",
      exec: execMock,
    };
    client.prefixCommands.set("custom", execCmd);

    message.content = "kcustom arg1 arg2";
    await messageCreate(client, message);

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(client, message, ["arg1", "arg2"]);
  });

  it("resolves and invokes command registered under an alias", async () => {
    const runMock = jest.fn().mockResolvedValue();
    const playCmd = {
      name: "play",
      aliases: ["p"],
      run: runMock,
    };
    client.prefixCommands.set("play", playCmd);
    client.prefixCommands.set("p", playCmd);

    message.content = "kp song title";
    await messageCreate(client, message);

    expect(runMock).toHaveBeenCalledTimes(1);
    expect(runMock).toHaveBeenCalledWith(
      client,
      message,
      ["song", "title"],
      "k",
    );
  });

  it("ignores slash-only command without falling back to client.commands", async () => {
    const slashRun = jest.fn().mockResolvedValue();
    client.commands.set("help", {
      data: { name: "help" },
      run: slashRun,
    });
    // Not in client.prefixCommands

    message.content = "khelp";
    await messageCreate(client, message);

    expect(slashRun).not.toHaveBeenCalled();
    expect(message.reply).not.toHaveBeenCalled();
  });

  it("defensively replies if a resolved command has neither run nor exec", async () => {
    client.prefixCommands.set("broken", { name: "broken" });

    message.content = "kbroken";
    await messageCreate(client, message);

    expect(message.reply).toHaveBeenCalledWith(
      "❌ `kbroken` isn't available as a prefix command. Try `/broken` instead.",
    );
  });

  it("silently ignores unknown commands / typos", async () => {
    message.content = "kunknowncommand 123";
    await messageCreate(client, message);

    expect(message.reply).not.toHaveBeenCalled();
  });

  it("checks userPermissions and warns when member lacks permissions", async () => {
    const runMock = jest.fn().mockResolvedValue();
    const adminCmd = {
      name: "adminonly",
      userPermissions: "ManageGuild",
      run: runMock,
    };
    client.prefixCommands.set("adminonly", adminCmd);

    message.member.permissions.has = jest.fn().mockReturnValue(false);
    message.content = "kadminonly";

    await messageCreate(client, message);

    expect(runMock).not.toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalledWith(
      "❌ | You don't have enough permissions to use this command.",
    );
  });

  it("catches command runtime error and replies with error message", async () => {
    const failingCmd = {
      name: "fail",
      run: jest.fn().mockRejectedValue(new Error("Command failed")),
    };
    client.prefixCommands.set("fail", failingCmd);

    message.content = "kfail";
    await messageCreate(client, message);

    expect(message.reply).toHaveBeenCalledWith(
      "There was an error trying to execute that command!",
    );
  });

  it("ignores messages from bots or without a guild", async () => {
    const runMock = jest.fn().mockResolvedValue();
    client.prefixCommands.set("play", { name: "play", run: runMock });

    message.author.bot = true;
    message.content = "kplay song";
    await messageCreate(client, message);
    expect(runMock).not.toHaveBeenCalled();

    message.author.bot = false;
    message.guild = null;
    await messageCreate(client, message);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("ignores messages not starting with the configured prefix", async () => {
    const runMock = jest.fn().mockResolvedValue();
    client.prefixCommands.set("play", { name: "play", run: runMock });

    message.content = "!play song";
    await messageCreate(client, message);
    expect(runMock).not.toHaveBeenCalled();
  });
});
