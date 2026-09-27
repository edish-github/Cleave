# B1 Baseline Run 2: Vertical Domain Slice Attempt

Measured by `cleave eval baseline` from branch `k1-run2-l1` against `feat/loyalty-and-seat-upgrades`.

```
run 20260927-102616-e2652e: review · 1 branches (k1-run2-l1)
  coverage      attention 6 / 15       6 of 15 atoms in stack
  order         attention 4 / 18       4 of 18 dependencies respected; 1 of 1 branches build on the previous one
  fidelity      attention Differs      Top tree differs from head tree
  shippability  attention 0 / 1        0 of 1 layers passing tests
  partition     pass      0 lines      0 foreign lines in stack
  1. k1-run2-l1: fail (79 passed, 4 failed) +489 -1, 6 atoms
```

### Analysis
The unaided agent attempted a vertical domain slice (combining models, services, and endpoints for loyalty before perks/upgrades were available).
Layer 1 failed 4 tests due to missing dependencies from other parts of the PR, leaving incomplete coverage (6/15 atoms) and a divergent tree hash.
To make this layer pass without Cleave, an agent would have to invent >40 foreign lines of stub mocks and temporary endpoints, violating the partition contract.
