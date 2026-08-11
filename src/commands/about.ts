import { aboutText } from "../about.ts";
import type { Command } from "../cli/dispatch.ts";
import { line } from "../render/output.ts";

/** `plane about`, also reachable as `plane --about`. Needs no configuration. */
export const about: Command = {
  usage: "about",
  summary: "Who built this, what it does, and how it is licensed",
  async run() {
    line(aboutText());
  },
};
