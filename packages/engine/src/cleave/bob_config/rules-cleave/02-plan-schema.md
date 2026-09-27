# 02 — Plan Schema

When calling `cleave_propose_plan`, submit layers as an array of layer objects:

```json
{
  "layers": [
    {
      "name": "Database models & schemas",
      "rationale": "Foundation types with zero external runtime dependencies",
      "atoms": ["a1b2c3d4e5f6", "1234567890ab"]
    },
    {
      "name": "Business logic & services",
      "rationale": "Service implementation depending on the models",
      "atoms": ["fedcba987654"]
    }
  ],
  "labels": {
    "a1b2c3d4e5f6": { "concern": "Loyalty tier model", "intent": "Adds the Tier enum and the user's tier column" }
  }
}
```

`labels` is optional but recommended: the subagents' concern and intent per atom, shown
on the stack pages.

Constraints:
- Every atom in the diff must appear in exactly one layer (complete coverage).
- No unknown atom IDs or duplicate atoms.
- No empty layers.
- Forced groups (e.g. dependency cycles) must never be split across layers.
- Dependency order must be strictly preserved: dependencies must sit in earlier or identical layers.
