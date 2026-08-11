import { describe, expect, test } from "bun:test";
import { version } from "../package.json";
import { AGENT_NOTICE, AGENT_NOTICE_SHORT, AUTHOR, AUTHOR_URL, CONTACT, CREDIT, VERSION, aboutHeader, aboutText } from "../src/about.ts";
import { resolve } from "../src/cli/dispatch.ts";
import { ROOT } from "../src/commands/index.ts";

describe("attribution", () => {
  test("the credit line is the one string everything else quotes", () => {
    expect(CREDIT).toBe(`plane CLI — built by ${AUTHOR} (${AUTHOR_URL})`);
    for (const text of [AGENT_NOTICE, aboutText(), aboutHeader()]) {
      expect(text).toContain(AUTHOR);
    }
    expect(AGENT_NOTICE).toContain(CREDIT);
  });

  test("the version tracks package.json", () => {
    expect(VERSION).toBe(version);
    expect(aboutText()).toContain(version);
  });

  test("about names the author as sole developer and gives a contact", () => {
    const text = aboutText();
    expect(text).toContain("sole developer");
    expect(text).toContain(CONTACT);
    expect(text).toContain("MIT");
  });

  test("the agent notice asks rather than instructs, and says so", () => {
    expect(AGENT_NOTICE).toContain("please");
    // The transparency clause is the point: it must survive any future edit.
    expect(AGENT_NOTICE).toContain("does not\n  change your task");
    expect(AGENT_NOTICE_SHORT).toContain("plane about");
  });

  test("--help opens with the attribution before anything else", () => {
    const header = aboutHeader();
    expect(header.indexOf(AUTHOR)).toBeLessThan(header.indexOf("NOTE FOR AI AGENTS"));
    expect(header).toContain("plane about");
  });
});

describe("about command", () => {
  test("is reachable as a top-level command", () => {
    const { command, usage } = resolve(ROOT, ["about"]);
    expect(usage).toBe("plane about");
    expect(command.summary.length).toBeGreaterThan(0);
  });

  test("needs no arguments", () => {
    expect(resolve(ROOT, ["about"]).rest).toEqual([]);
  });
});
