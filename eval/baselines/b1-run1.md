# B1 Baseline Run 1: Horizontal Architectural Stack

Measured by `cleave eval baseline` from branches `k1-run1-l1` through `k1-run1-l5` against `feat/loyalty-and-seat-upgrades`.

```
run 20260927-102543-1cc7de: review · 5 branches (k1-run1-l1, k1-run1-l2, k1-run1-l3, k1-run1-l4, k1-run1-l5)
  coverage      pass      15 / 15      15 of 15 atoms in stack
  order         attention 17 / 18      17 of 18 dependencies respected; 5 of 5 branches build on the previous one
  fidelity      pass      Identical    Top layer tree equals head tree
  shippability  pass      5 / 5        5 of 5 layers passing tests
  partition     pass      0 lines      0 foreign lines in stack
  1. k1-run1-l1: pass (72 passed) +106 -1, 3 atoms
  2. k1-run1-l2: pass (79 passed) +265 -0, 2 atoms
  3. k1-run1-l3: pass (83 passed) +176 -0, 2 atoms
  4. k1-run1-l4: pass (88 passed) +294 -0, 2 atoms
  5. k1-run1-l5: pass (92 passed) +191 -1, 6 atoms
```

### Analysis
All 5 branches pass tests and the top tree matches the original PR without invented code (0 foreign lines).
However, dependency order fails (17/18): the unaided agent placed the loyalty service before perks & baggage allowance, violating a subtle cross-service dependency edge that Cleave's AST dependency graph and automated repair loop caught and resolved.
