import type { StackSpec } from "../../spec";

/**
 * Review sample: rounding strategies are registered by name at import time, so
 * Layer 02 depends on Layer 03 through a string lookup that static analysis can't see.
 * Two repairs didn't make Layer 02 pass on its own; Cleave stopped and asks for review.
 */
export const orbitPricing57: StackSpec = {
  id: "orbit-pricing-57",
  repoId: "orbit-pricing",
  prNumber: 57,
  title: "Move fare math to Decimal",
  branch: "refactor/decimal-fares",
  base: "main",
  status: "review",
  visibility: "private",
  command: "pytest -q",
  headTree: "4f2b8e17c90d3a65e1f7b2c48d9a0e3f5b6c7d81",
  runStartedMinutesAgo: 41,
  prStart: 62,
  bob: {
    surface: "Bob IDE",
    mode: "✂ Cleave",
    bobcoins: 2.37,
    tokens: 268940,
    toolCalls: 58,
    mcpCalls: 19,
    subagents: 4,
    durationSec: 431,
    hookAllowed: 58,
    hookBlocked: 0,
  },
  layers: [
    {
      name: "Money type",
      rationale:
        "Introduces a Decimal-backed Money type and the registry rounding strategies plug into. Existing code keeps using floats until Layer 02.",
      tests: 128,
      durationMs: 5200,
      atoms: [
        { key: "money", file: "pricing/money.py", summary: "Decimal-backed Money type", add: 64, kind: "new-file" },
        { key: "registry", file: "pricing/registry.py", summary: "Rounding strategy registry", add: 28, kind: "new-file" },
        { key: "cfg-rounding", file: "pricing/config.py", summary: "Default ROUNDING to half_even", add: 2, del: 1 },
        { key: "init-money", file: "pricing/__init__.py", summary: "Export Money", add: 2 },
        { key: "t-money", file: "tests/test_money.py", summary: "Money arithmetic tests", add: 58, kind: "new-file" },
      ],
    },
    {
      name: "Fare calculation",
      rationale:
        "Base fares and taxes move from float to Money and round through the configured strategy.",
      tests: 131,
      durationMs: 5900,
      atoms: [
        { key: "fares-import", file: "pricing/fares.py", summary: "Import Money and the registry", add: 2, del: 1 },
        { key: "base-fare", file: "pricing/fares.py", summary: "Compute base fares in Money", add: 14, del: 9 },
        { key: "taxes", file: "pricing/fares.py", summary: "Compute taxes in Money", add: 11, del: 7 },
        { key: "apply-rounding", file: "pricing/fares.py", summary: "Round through the configured strategy", add: 6, del: 2 },
        { key: "t-fares", file: "tests/test_fares.py", summary: "Update fare tests for Decimal", add: 46, del: 12 },
        { key: "load-strategies", file: "pricing/__init__.py", summary: "Load strategy modules on import", add: 4 },
        { key: "rounding", file: "pricing/rounding.py", summary: "half_even and half_up strategies", add: 41, kind: "new-file" },
      ],
    },
    {
      name: "Currency rounding",
      rationale: "Configures which modules provide rounding strategies, with tests for each strategy.",
      tests: 141,
      durationMs: 6100,
      atoms: [
        { key: "cfg-modules", file: "pricing/config.py", summary: "Add STRATEGY_MODULES", add: 3 },
        { key: "t-rounding", file: "tests/test_rounding.py", summary: "Rounding strategy tests", add: 39, kind: "new-file" },
      ],
    },
    {
      name: "Callers & tests",
      rationale: "Quotes, invoices and revenue reports switch to Money. Their tests assert exact Decimal values.",
      tests: 144,
      durationMs: 6400,
      atoms: [
        { key: "quotes", file: "api/quotes.py", summary: "Quote fares as Money", add: 8, del: 6 },
        { key: "invoices", file: "api/invoices.py", summary: "Invoice totals as Money", add: 7, del: 5 },
        { key: "revenue", file: "reports/revenue.py", summary: "Sum revenue in Decimal", add: 5, del: 4 },
        { key: "t-quotes", file: "tests/test_quotes.py", summary: "Exact Decimal quote assertions", add: 12, del: 3 },
        { key: "t-invoices", file: "tests/test_invoices.py", summary: "Exact Decimal invoice assertions", add: 9, del: 2 },
      ],
    },
  ],
  dependencies: [
    { from: "base-fare", to: "money", symbol: "Money", kind: "import" },
    { from: "apply-rounding", to: "registry", symbol: "registry.get", kind: "call" },
    { from: "rounding", to: "registry", symbol: "@register", kind: "import" },
    { from: "apply-rounding", to: "rounding", symbol: "\"half_even\"", kind: "runtime", discovered: true },
    { from: "quotes", to: "base-fare", symbol: "base_fare", kind: "call" },
    { from: "invoices", to: "taxes", symbol: "taxes_for", kind: "call" },
    { from: "revenue", to: "money", symbol: "Money", kind: "import" },
  ],
  rounds: [
    {
      layers: 4,
      failures: [
        {
          layer: 2,
          test: "tests/test_fares.py::test_rounding_half_even",
          message: "KeyError: 'half_even'",
          failed: 1,
        },
      ],
    },
    {
      layers: 4,
      failures: [
        {
          layer: 2,
          test: "tests/test_fares.py (collection)",
          message: "ModuleNotFoundError: No module named 'pricing.rounding'",
          failed: 1,
        },
      ],
    },
    {
      layers: 4,
      failures: [
        {
          layer: 2,
          test: "tests/test_fares.py (collection)",
          message: "AttributeError: module 'pricing.config' has no attribute 'STRATEGY_MODULES'",
          failed: 1,
        },
      ],
    },
  ],
  repairs: [
    {
      afterRound: 0,
      atom: "load-strategies",
      from: 3,
      to: 2,
      reason: "Fares look up 'half_even' by name, and strategies only register when their module is loaded. Loading moves next to the lookup.",
    },
    {
      afterRound: 1,
      atom: "rounding",
      from: 3,
      to: 2,
      reason: "The loader now runs in Layer 02 but the module it loads is still in Layer 03.",
    },
  ],
  issue: {
    title: "Layer 02 fails on its own",
    summary: "One layer still fails its tests after two repairs.",
    layer: 2,
    test: "tests/test_fares.py",
    expected: "pytest -q passes with Layers 01–02 applied",
    found: "AttributeError: module 'pricing.config' has no attribute 'STRATEGY_MODULES'",
    log: `==================================== ERRORS ====================================
______________________ ERROR collecting tests/test_fares.py ______________________
pricing/__init__.py:9: in <module>
    for name in config.STRATEGY_MODULES:
E   AttributeError: module 'pricing.config' has no attribute 'STRATEGY_MODULES'
=========================== short test summary info ============================
ERROR tests/test_fares.py - AttributeError: module 'pricing.config' has no ...
1 error in 0.84s`,
    explanation:
      "Fare calculation, the strategy loader and the rounding module depend on each other at runtime through a string lookup. Keeping them in separate layers would need new glue code, and Cleave never writes code.",
    merge: {
      into: 2,
      from: 3,
      name: "Fare calculation & rounding",
      rationale:
        "Fares switch to Money and round through strategies that register by name. The loader, the strategies and their configuration have to land together, so they share one layer.",
    },
  },
};
