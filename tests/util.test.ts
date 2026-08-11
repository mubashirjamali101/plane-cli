import { describe, expect, test } from "bun:test";
import { CliError } from "../src/errors.ts";
import { formatMinutes, isUuid, memoize, parseDuration, splitList } from "../src/util.ts";

describe("isUuid", () => {
  test("accepts a canonical uuid in either case", () => {
    expect(isUuid("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toBe(true);
    expect(isUuid("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE")).toBe(true);
  });

  test("rejects anything else", () => {
    for (const value of ["", "Todo", "aaaaaaaa", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-extra"]) {
      expect(isUuid(value)).toBe(false);
    }
  });
});

describe("splitList", () => {
  test("trims entries and drops empties", () => {
    expect(splitList(" a , b ,, c ")).toEqual(["a", "b", "c"]);
    expect(splitList(undefined)).toEqual([]);
  });
});

describe("parseDuration", () => {
  test("reads bare minutes", () => {
    expect(parseDuration("90")).toBe(90);
  });

  test("reads compound values", () => {
    expect(parseDuration("1h30m")).toBe(90);
    expect(parseDuration("2h")).toBe(120);
    expect(parseDuration("45m")).toBe(45);
    expect(parseDuration(" 1 h 5 m ")).toBe(65);
  });

  test("rejects a value with no recognisable unit", () => {
    expect(() => parseDuration("soon")).toThrow(CliError);
  });
});

describe("formatMinutes", () => {
  test("renders hours and minutes", () => {
    expect(formatMinutes(90)).toBe("1h 30m (90 min)");
    expect(formatMinutes(120)).toBe("2h (120 min)");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(undefined)).toBe("N/A");
  });
});

describe("memoize", () => {
  test("runs the loader once and reuses the result", async () => {
    let calls = 0;
    const load = memoize(async () => ++calls);
    expect(await load()).toBe(1);
    expect(await load()).toBe(1);
    expect(calls).toBe(1);
  });
});
