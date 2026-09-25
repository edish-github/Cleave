import type { StackSpec } from "../../spec";

const B = "booking_system_backend";

/** Published sample: loyalty tiers and seat upgrades, verified on the first round. */
export const galaxiumTravels179: StackSpec = {
  id: "galaxium-travels-179",
  repoId: "galaxium-travels",
  prNumber: 179,
  title: "Loyalty tiers & seat upgrades",
  branch: "feature/loyalty-upgrades",
  base: "main",
  status: "published",
  visibility: "public",
  command: "pytest -q",
  headTree: "8025d3c2683e485b0b9df97e2fae1122e894d4d6",
  runStartedMinutesAgo: 1630,
  publishedMinutesAgo: 1580,
  prStart: 180,
  bob: {
    surface: "Bob IDE",
    mode: "✂ Cleave",
    bobcoins: 1.21,
    tokens: 142610,
    toolCalls: 31,
    mcpCalls: 9,
    subagents: 3,
    durationSec: 248,
    hookAllowed: 31,
    hookBlocked: 0,
  },
  layers: [
    {
      name: "Loyalty model",
      rationale:
        "Adds loyalty tiers and points to users, and the schemas the later layers return. No behaviour changes yet.",
      tests: 44,
      durationMs: 2900,
      atoms: [
        { key: "tier-enum", file: `${B}/models.py`, summary: "Add LoyaltyTier enum", add: 8 },
        { key: "points", file: `${B}/models.py`, summary: "Add loyalty_points to User", add: 2 },
        { key: "loyalty-out", file: `${B}/schemas.py`, summary: "Add LoyaltyOut", add: 7 },
        { key: "upgrade-req", file: `${B}/schemas.py`, summary: "Add UpgradeRequest", add: 5 },
        { key: "gitignore", file: ".gitignore", summary: "Ignore local venvs in the backend", add: 1 },
      ],
    },
    {
      name: "Loyalty & perks",
      rationale:
        "Points accrue on every booking, and perks are derived from the tier. The services arrive with their own tests.",
      tests: 59,
      durationMs: 3600,
      atoms: [
        { key: "loyalty-svc", file: `${B}/services/loyalty.py`, summary: "Award points and compute tiers", add: 52, kind: "new-file" },
        { key: "perks-svc", file: `${B}/services/perks.py`, summary: "Perks and baggage allowance by tier", add: 41, kind: "new-file" },
        { key: "award", file: `${B}/services/booking.py`, summary: "Award points when a flight is booked", add: 6 },
        { key: "booking-import", file: `${B}/services/booking.py`, summary: "Import the loyalty service", add: 1, del: 1 },
        { key: "t-loyalty", file: `${B}/tests/test_loyalty.py`, summary: "Loyalty service tests", add: 63, kind: "new-file" },
        { key: "t-perks", file: `${B}/tests/test_perks.py`, summary: "Perks tests", add: 48, kind: "new-file" },
      ],
    },
    {
      name: "Seat upgrades",
      rationale:
        "Upgrades spend points for a better seat class when one is available on the flight.",
      tests: 67,
      durationMs: 3800,
      atoms: [
        { key: "upgrade-svc", file: `${B}/services/upgrade.py`, summary: "Upgrade a booking's seat class", add: 67, kind: "new-file" },
        { key: "seat-class", file: `${B}/models.py`, summary: "Add seat_class to Booking", add: 1 },
        { key: "seat-class-out", file: `${B}/schemas.py`, summary: "Expose seat_class on BookingOut", add: 1 },
        { key: "class-available", file: `${B}/services/flight.py`, summary: "Check seat class availability", add: 9 },
        { key: "t-upgrade", file: `${B}/tests/test_upgrade.py`, summary: "Upgrade tests", add: 71, kind: "new-file" },
      ],
    },
    {
      name: "Endpoints",
      rationale: "Exposes loyalty and upgrades over REST and MCP, with endpoint tests.",
      tests: 74,
      durationMs: 4400,
      atoms: [
        { key: "srv-import", file: `${B}/server.py`, summary: "Import loyalty and upgrade services", add: 2, del: 1 },
        { key: "srv-loyalty", file: `${B}/server.py`, summary: "GET /users/{user_id}/loyalty", add: 14 },
        { key: "srv-upgrade", file: `${B}/server.py`, summary: "POST /bookings/{booking_id}/upgrade", add: 21 },
        { key: "mcp-loyalty", file: `${B}/server.py`, summary: "MCP tool: get_loyalty", add: 9 },
        { key: "t-endpoints", file: `${B}/tests/test_loyalty_endpoints.py`, summary: "Endpoint tests", add: 84, kind: "new-file" },
      ],
    },
  ],
  dependencies: [
    { from: "loyalty-svc", to: "tier-enum", symbol: "LoyaltyTier", kind: "import" },
    { from: "loyalty-svc", to: "points", symbol: "User.loyalty_points", kind: "model" },
    { from: "perks-svc", to: "tier-enum", symbol: "LoyaltyTier", kind: "import" },
    { from: "award", to: "loyalty-svc", symbol: "award_points", kind: "call" },
    { from: "upgrade-svc", to: "loyalty-svc", symbol: "spend_points", kind: "import" },
    { from: "upgrade-svc", to: "class-available", symbol: "seat_class_available", kind: "call" },
    { from: "srv-loyalty", to: "loyalty-out", symbol: "LoyaltyOut", kind: "model" },
    { from: "srv-upgrade", to: "upgrade-svc", symbol: "upgrade_booking", kind: "call" },
  ],
  rounds: [{ layers: 4 }],
  repairs: [],
};
