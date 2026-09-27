import { shippedBobConfig } from "./bob.generated";

/**
 * The Bob configuration Cleave ships (packages/engine/src/cleave/bob_config/), read from
 * those files by `npm run contracts`, so /docs/bob can't drift from what `cleave init`
 * installs. `contracts:check` fails in CI when they differ.
 */
export const bobFiles = {
  mode: { path: ".bob/custom_modes.yaml", language: "yaml", code: shippedBobConfig["custom_modes.yaml"] },
  mcp: { path: ".bob/mcp.json", language: "json", code: shippedBobConfig["mcp.json"] },
  hooks: { path: ".bob/settings.json", language: "json", code: shippedBobConfig["settings.json"] },
  procedure: { path: ".bob/rules-cleave/01-procedure.md", language: "markdown", code: shippedBobConfig["rules-cleave/01-procedure.md"] },
} as const;

export const mcpTools: { name: string; does: string; writes: string }[] = [
  { name: "cleave_start(base, head)", does: "Atomize, build the graph, write slices and open a run", writes: ".cleave/ only" },
  { name: "cleave_status()", does: "Atom count, current plan version, last verify result", writes: "—" },
  { name: "cleave_atoms(slice?)", does: "Atoms with file, line counts and symbols", writes: "—" },
  { name: "cleave_graph(atom_id?)", does: "Dependency edges and forced groups", writes: "—" },
  { name: "cleave_propose_plan(layers)", does: "Check coverage and order, save a plan version, return violations", writes: "Plan only" },
  { name: "cleave_move_atoms(ids, to_layer, reason)", does: "New plan version plus violations", writes: "Plan only" },
  { name: "cleave_verify()", does: "Build every prefix and run the check command in parallel", writes: "cleave/* branches" },
  { name: "cleave_verify_status(round)", does: "Poll a long verification round", writes: "—" },
  { name: "cleave_read_log(layer, round)", does: "Excerpt of a failing layer's log", writes: "—" },
  { name: "cleave_describe_layer(n, title, body)", does: "Store the pull request text for a layer", writes: "Text only" },
  { name: "cleave_finish()", does: "Write the report and close the run", writes: ".cleave/ only" },
];

export const guardRules = [
  "Read tools are allowed.",
  "Read-only explore subagents are allowed.",
  "Todo updates, questions to you and finishing the task are allowed.",
  "Calls to the cleave MCP server are allowed.",
  "Everything else is blocked with exit code 2 while a run is active: file writes, commands, mode switches and other MCP servers.",
];

export const commands = {
  install: "uv tool install ./packages/engine",
  init: "cleave init",
  ideRequest: "Cleave feat/loyalty-and-seat-upgrades onto main",
  headless: 'bob run --mode cleave --format stream-json --max-cost 3 "Cleave feat/loyalty-and-seat-upgrades onto main"',
  push: 'cleave push --title "<pull request title>" --pr <number> --head-branch <branch> --base-branch main',
  publish: "cleave publish",
  runner: "cleave runner",
};
