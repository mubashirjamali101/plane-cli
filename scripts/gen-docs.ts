#!/usr/bin/env bun
/**
 * Regenerate the command reference in CLI_DOCS.md from the command tree, so the
 * documentation cannot drift from what the binary accepts.
 *
 *   bun run docs           rewrite the generated block
 *   bun run docs --check   fail if it is out of date (used by CI)
 *
 * Everything outside the BEGIN/END markers is hand-written and left untouched.
 */
import { isGroup, walk } from "../src/cli/dispatch.ts";
import { ROOT } from "../src/commands/index.ts";

const DOC = new URL("../CLI_DOCS.md", import.meta.url).pathname;
const BEGIN = "<!-- BEGIN GENERATED COMMANDS -->";
const END = "<!-- END GENERATED COMMANDS -->";

function reference(): string {
  const sections: string[] = [];

  for (const [name, node] of Object.entries(ROOT.commands)) {
    const commands = isGroup(node)
      ? walk(node, ROOT.prefix)
      : [{ usage: (ROOT.prefix ?? "") + node.usage, summary: node.summary }];
    const body = commands
      .map(({ usage, summary }) => `${usage.replace(/\n/g, "\n    ")}\n    # ${summary}`)
      .join("\n\n");
    sections.push(`### ${name}\n\n${node.summary}.\n\n\`\`\`text\n${body}\n\`\`\``);
  }

  return sections.join("\n\n");
}

const current = await Bun.file(DOC).text();
const start = current.indexOf(BEGIN);
const end = current.indexOf(END);
if (start === -1 || end === -1) {
  console.error(`CLI_DOCS.md is missing the ${BEGIN} / ${END} markers.`);
  process.exit(1);
}

const updated =
  current.slice(0, start + BEGIN.length) + "\n\n" + reference() + "\n\n" + current.slice(end);

if (process.argv.includes("--check")) {
  if (updated !== current) {
    console.error("CLI_DOCS.md is out of date. Run: bun run docs");
    process.exit(1);
  }
  console.log("CLI_DOCS.md is up to date.");
} else {
  await Bun.write(DOC, updated);
  console.log("Updated CLI_DOCS.md");
}
