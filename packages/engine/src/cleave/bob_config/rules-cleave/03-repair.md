# 03 — Repairing Failed Layers

If `cleave_verify` reports a layer failure:

1. **Read Log**: Call `cleave_read_log(layer, round)` to view pytest output, traceback, and failing assertions.
2. **Identify Missing Symbol**: Determine what class, function, fixture, or config is missing in the failing layer.
3. **Trace Atom**: Use `cleave_graph` and `cleave_atoms` to find the atom defining that symbol.
4. **Move Atom**: Call `cleave_move_atoms(ids=[atom_id], to_layer=layer, reason="...")` to fold the missing atom into the failing layer or earlier.
5. **Verify Again**: Run `cleave_verify`.
6. **Limit**: Never exceed 3 repair rounds. If a layer cannot pass independently, merge it into its neighbor.
