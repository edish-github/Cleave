/**
 * The Bob configuration Cleave ships (packages/engine/src/cleave/bob_config/).
 *
 * Kept here so /docs/bob and Settings render the same text. When the engine
 * package lands in this repo, replace these strings with a build-time read of
 * those files so the page can never drift from what `cleave init` installs.
 */

export const bobFiles = {
  mode: {
    path: ".bob/custom_modes.yaml",
    language: "yaml",
    code: `customModes:
  - slug: cleave
    name: ✂ Cleave
    description: Split a large diff into a proven stack. Never writes code.
    roleDefinition: >-
      You split an existing diff into an ordered stack of layers. You only group
      and order the atoms Cleave gives you. You never write or edit code.
    whenToUse: A branch or PR is too large to review as one change.
    customInstructions: Follow .bob/rules-cleave/. Change the plan only with cleave_* tools.
    groups: [read, mcp, subagent, todo]
    allowedSubagents: [explore]              # read-only subagents`,
  },
  mcp: {
    path: ".bob/mcp.json",
    language: "json",
    code: `{
  "mcpServers": {
    "cleave": {
      "command": "cleave",
      "args": ["mcp"],
      "alwaysAllow": [
        "cleave_start", "cleave_status", "cleave_atoms", "cleave_graph",
        "cleave_propose_plan", "cleave_move_atoms", "cleave_verify",
        "cleave_verify_status", "cleave_read_log", "cleave_describe_layer",
        "cleave_finish"
      ]
    }
  }
}`,
  },
  // Hook schema to confirm against real Bob payloads (routes doc, open check C1).
  hooks: {
    path: ".bob/settings.json",
    language: "json",
    code: `{
  "hooks": {
    "PreToolUse": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "python3 .bob/hooks/guard.py" }] }
    ],
    "PostToolUse": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "python3 .bob/hooks/audit.py" }] }
    ]
  }
}`,
  },
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
  "Todo updates are allowed.",
  "Calls to the cleave MCP server are allowed.",
  "Everything else is blocked with exit code 2 while a run is active.",
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
