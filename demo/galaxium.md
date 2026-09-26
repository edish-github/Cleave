# Demo target: Galaxium Travels

The demo splits a real pull request on a public fork of IBM's Galaxium Travels sample app.

| | |
| --- | --- |
| Fork | https://github.com/edish-github/galaxium-travels |
| Pull request | [#1 — Loyalty tiers & seat upgrades](https://github.com/edish-github/galaxium-travels/pull/1) |
| Branch | `feat/loyalty-and-seat-upgrades` → `main` |
| Base SHA | `e4e18ae1b05e0c899abaefd920f5ffcb4326b021` |
| Head SHA | `99ab7d49de5258cfa504eea0639dddee901db4d9` |
| Size | 11 files, +1,032 −2 |
| Check command | `pytest -q` in `booking_system_backend/` |

## Reproduce

```bash
git clone https://github.com/edish-github/galaxium-travels ~/galaxium-travels
cd ~/galaxium-travels
git fetch origin feat/loyalty-and-seat-upgrades

# One shared environment for every layer's tests. Verification finds
# booking_system_backend/.venv and reuses it, so no per-layer setup is needed.
cd booking_system_backend
uv venv .venv --python 3.11                        # uv's venv ignores itself in git
uv pip install --python .venv -r requirements.txt "mcp<2"
cd ..
cleave init --check "pytest -q" --workdir booking_system_backend
```

Why `mcp<2`: the backend's requirements are unpinned, and `fastapi-mcp` 0.4 breaks with
`mcp` 2.x (`Server.__init__() takes 2 positional arguments`): 35 of 72 tests error even on
`main`. With `mcp<2`, `main` passes 72/72 and the PR head 92/92. If you create the venv with
`python -m venv` instead, add `.venv` to `.git/info/exclude`: atomize refuses a working
tree with untracked files.

Then, in Bob IDE, switch to **✂ Cleave** and send:

```
Cleave feat/loyalty-and-seat-upgrades onto main
```

When the run finishes:

```bash
export CLEAVE_URL=https://<your-deployment>   CLEAVE_TOKEN=<runner token>
cleave push --title "Loyalty tiers & seat upgrades" --pr 1 \
  --head-branch feat/loyalty-and-seat-upgrades --base-branch main
```
