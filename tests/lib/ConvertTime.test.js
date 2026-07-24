const {
  convertTime,
  convertQueue,
  convertNumber,
  chunk,
  convertHmsToMs,
} = require("../../src/lib/ConvertTime");

describe("ConvertTime Tests", () => {
  describe("convertTime", () => {
    it("converts duration under 1 hour correctly", () => {
      expect(convertTime(65000)).toBe("01:05"); // 1 min 5 sec
      expect(convertTime(5000)).toBe("00:05"); // 5 sec
    });

    it("converts duration over 1 hour correctly", () => {
      expect(convertTime(3665000)).toBe("01:01:05"); // 1 hr 1 min 5 sec
    });
  });

  describe("convertQueue", () => {
    it("returns current song duration when total is false", () => {
      const player = {
        queue: {
          current: { length: 120000 },
          reduce: jest.fn(),
        },
      };
      expect(convertQueue(player, false)).toBe("02:00");
    });

    it("returns total queue duration when total is true", () => {
      const player = {
        queue: Object.assign([{ length: 60000 }, { length: 30000 }], {
          current: { length: 90000 },
        }),
      };
      // 90000 + 60000 + 30000 = 180000ms = 3 mins
      expect(convertQueue(player, true)).toBe("03:00");
    });

    it("handles missing current track cleanly", () => {
      const player = {
        queue: Object.assign([], { current: null }),
      };
      expect(convertQueue(player, false)).toBe("00:00");
      expect(convertQueue(player, true)).toBe("00:00");
    });
  });

  describe("convertNumber", () => {
    it("abbreviates numbers correctly", () => {
      expect(convertNumber(1500, 1)).toBe("1.5K");
      expect(convertNumber(2500000, 2)).toBe("2.5M");
      expect(convertNumber(3500000000, 1)).toBe("3.5B");
      expect(convertNumber(4500000000000, 1)).toBe("4.5T");
      expect(convertNumber(999, 1)).toBe(999);
    });
  });

  describe("chunk", () => {
    it("splits array into chunks", () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });
  });

  describe("convertHmsToMs", () => {
    it("converts short strings directly to ms", () => {
      expect(convertHmsToMs("5")).toBe(5000);
    });

    it("converts mm:ss format to ms", () => {
      expect(convertHmsToMs("02:05")).toBe(125000);
    });

    it("converts hh:mm:ss format to ms", () => {
      expect(convertHmsToMs("01:02:05")).toBe(3725000);
    });
  });
});
