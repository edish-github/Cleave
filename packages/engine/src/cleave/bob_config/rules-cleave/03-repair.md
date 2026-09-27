# 03 — Repairing Failed Layers

If `cleave_verify` reports a layer failure:

1. **Read Log**: Call `cleave_read_log(layer, round)` to view pytest output, traceback, and failing assertions.
2. **Identify Missing Symbol**: Determine what class, function, fixture, or config is missing in the failing layer.
3. **Trace Atom**: Use `cleave_graph` and `cleave_atoms` to find the atom defining that symbol.
4. **Move Atom**: Call `cleave_move_atoms(ids=[atom_id], to_layer=layer, reason="...")` to fold the missing atom into the failing layer or earlier.
5. **Verify Again**: Run `cleave_verify`.
6. **Limit**: Never exceed 3 repair rounds. If a layer still can't pass on its own, merge it
   into its neighbour by moving all of its atoms into the next layer with `cleave_move_atoms`.

Typical logs and the move they call for:

| Log says | Move |
| --- | --- |
| `ImportError` / `NameError` / `AttributeError` on a new name | the atom that defines the name, to the failing layer or earlier |
| `fixture '…' not found` | the fixture's atom (usually in `conftest.py`) to the test's layer or earlier |
| a test fails on behaviour, not a missing name | the test, to the layer of the code it tests |
