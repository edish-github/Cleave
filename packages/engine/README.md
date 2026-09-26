# cleave (engine)

The deterministic half of Cleave. Bob decides how atoms are grouped and ordered; this package
does everything else: cut the diff into atoms, build the dependency graph, check plans, build
and verify every layer, write the report, and serve Bob's only write surface over MCP.

```bash
uv sync --extra dev
uv run pytest                 # unit specs
GALAXIUM_REPO=~/galaxium-travels uv run pytest -m integration
```

Contracts live in `/schemas`. `cleave.models` mirrors them and `tests/test_models.py` keeps
the two in step.
