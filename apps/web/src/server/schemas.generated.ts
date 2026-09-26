/* GENERATED from /schemas by `npm run contracts`. Do not edit by hand. */

export const schemas = {
  "atom.schema.json": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://raw.githubusercontent.com/edish-github/Cleave/main/schemas/atom.schema.json",
  "title": "AtomsFile",
  "description": "atoms.json: the pull request cut into atoms. An atom is the smallest unit Cleave moves between layers: one hunk, or one whole file for new, deleted, renamed, binary or mode-only changes. Atoms are never edited.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "version",
    "base_sha",
    "head_sha",
    "head_tree",
    "atoms"
  ],
  "properties": {
    "version": {
      "const": 1
    },
    "base_sha": {
      "$ref": "#/$defs/sha"
    },
    "head_sha": {
      "$ref": "#/$defs/sha"
    },
    "head_tree": {
      "$ref": "#/$defs/sha",
      "description": "Tree hash of head. The last layer must reproduce it exactly."
    },
    "atoms": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/atom"
      }
    }
  },
  "$defs": {
    "sha": {
      "type": "string",
      "pattern": "^[0-9a-f]{40}$"
    },
    "atom_id": {
      "type": "string",
      "pattern": "^[0-9a-f]{12}$",
      "description": "First 12 hex chars of sha256(file path + NUL + patch text). Stable across runs of the same diff."
    },
    "atom_kind": {
      "type": "string",
      "enum": [
        "hunk",
        "new_file",
        "deleted_file",
        "rename",
        "binary",
        "mode"
      ]
    },
    "atom": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "file",
        "kind",
        "added",
        "removed",
        "patch",
        "is_test"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/atom_id"
        },
        "file": {
          "type": "string",
          "minLength": 1,
          "description": "Path in head (or in base for deleted files), relative to the repo root."
        },
        "old_file": {
          "type": [
            "string",
            "null"
          ],
          "description": "Previous path for renames, else null."
        },
        "kind": {
          "$ref": "#/$defs/atom_kind"
        },
        "old_start": {
          "type": "integer",
          "minimum": 0
        },
        "old_len": {
          "type": "integer",
          "minimum": 0
        },
        "new_start": {
          "type": "integer",
          "minimum": 0
        },
        "new_len": {
          "type": "integer",
          "minimum": 0
        },
        "added": {
          "type": "integer",
          "minimum": 0
        },
        "removed": {
          "type": "integer",
          "minimum": 0
        },
        "patch": {
          "type": "string",
          "description": "Verbatim diff text for this atom: the @@ hunk for text changes, or the whole-file section (including `GIT binary patch` for binary files) for whole-file atoms. Applying it with `git apply --cached --unidiff-zero` must work."
        },
        "is_test": {
          "type": "boolean"
        },
        "symbols": {
          "type": [
            "object",
            "null"
          ],
          "additionalProperties": false,
          "description": "Names this atom defines and references, filled by the graph step.",
          "properties": {
            "defines": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "references": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        }
      }
    }
  }
},
  "bundle.schema.json": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://raw.githubusercontent.com/edish-github/Cleave/main/schemas/bundle.schema.json",
  "title": "Bundle",
  "description": "What `cleave push` sends to POST /api/ingest/bundle: one JSON document holding a finished run's manifest and artifacts. Send it gzip-encoded for large diffs.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "version",
    "kind",
    "run_id",
    "source",
    "repo",
    "title",
    "created_at",
    "atoms",
    "graph",
    "plans",
    "report",
    "events"
  ],
  "properties": {
    "version": {
      "const": 1
    },
    "kind": {
      "const": "cleave.bundle"
    },
    "run_id": {
      "$ref": "./report.schema.json#/$defs/run_id"
    },
    "source": {
      "type": "string",
      "enum": [
        "ide",
        "runner"
      ]
    },
    "run_kind": {
      "type": "string",
      "enum": [
        "cleave",
        "baseline_b1"
      ],
      "default": "cleave"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200
    },
    "repo": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "full_name"
      ],
      "properties": {
        "full_name": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$"
        },
        "default_branch": {
          "type": [
            "string",
            "null"
          ]
        }
      }
    },
    "pull_request": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "number",
            "head_branch",
            "base_branch"
          ],
          "properties": {
            "number": {
              "type": "integer",
              "minimum": 1
            },
            "url": {
              "type": [
                "string",
                "null"
              ]
            },
            "head_branch": {
              "type": "string"
            },
            "base_branch": {
              "type": "string"
            },
            "author": {
              "type": [
                "string",
                "null"
              ]
            }
          }
        }
      ]
    },
    "eval": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "group",
            "dataset"
          ],
          "properties": {
            "group": {
              "type": "string"
            },
            "dataset": {
              "type": "string"
            },
            "ground_truth": {
              "type": [
                "object",
                "null"
              ]
            }
          }
        }
      ]
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "atoms": {
      "$ref": "./atom.schema.json"
    },
    "graph": {
      "$ref": "./graph.schema.json"
    },
    "plans": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "./plan.schema.json"
      }
    },
    "report": {
      "$ref": "./report.schema.json"
    },
    "events": {
      "type": "array",
      "items": {
        "$ref": "./event.schema.json"
      }
    }
  }
},
  "event.schema.json": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://raw.githubusercontent.com/edish-github/Cleave/main/schemas/event.schema.json",
  "title": "Event",
  "description": "One line of events.ndjson. Engine steps, Bob's MCP calls, hook decisions and runner messages all land here, and the Activity tab is built from them.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "ts",
    "source",
    "type",
    "payload"
  ],
  "properties": {
    "ts": {
      "type": "string",
      "format": "date-time"
    },
    "source": {
      "type": "string",
      "enum": [
        "engine",
        "bob",
        "hook",
        "runner",
        "mcp"
      ]
    },
    "type": {
      "type": "string",
      "pattern": "^[a-z_]+(\\.[a-z_]+)+$",
      "description": "Known types: run.started, run.finished, atoms.cut, graph.built, slices.written, subagent.spawned, subagent.finished, plan.proposed, plan.checked, verify.started, layer.passed, layer.failed, verify.passed, atoms.moved, review.required, layers.merged, layer.described, hook.allowed, hook.blocked, mcp.called, stack.published. Unknown types are shown generically."
    },
    "run_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "tool": {
      "type": [
        "string",
        "null"
      ],
      "description": "Tool or command behind the event, e.g. cleave_move_atoms."
    },
    "payload": {
      "type": "object"
    }
  }
},
  "graph.schema.json": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://raw.githubusercontent.com/edish-github/Cleave/main/schemas/graph.schema.json",
  "title": "Graph",
  "description": "graph.json: which atoms need which. An edge from A to B means A needs B, so B must sit in the same or an earlier layer.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "version",
    "edges",
    "groups"
  ],
  "properties": {
    "version": {
      "const": 1
    },
    "edges": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/edge"
      }
    },
    "groups": {
      "type": "array",
      "description": "Forced groups: atoms in a dependency cycle (a strongly connected component) must share a layer.",
      "items": {
        "type": "array",
        "minItems": 2,
        "items": {
          "$ref": "./atom.schema.json#/$defs/atom_id"
        }
      }
    }
  },
  "$defs": {
    "edge_kind": {
      "type": "string",
      "enum": [
        "import",
        "call",
        "model",
        "fixture",
        "file_order",
        "runtime"
      ],
      "description": "import/call/model: Python AST. fixture: pytest fixture by name. file_order: create-before-edit or same-file order. runtime: found only when a layer failed its check."
    },
    "edge": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "from",
        "to",
        "kind",
        "source"
      ],
      "properties": {
        "from": {
          "$ref": "./atom.schema.json#/$defs/atom_id"
        },
        "to": {
          "$ref": "./atom.schema.json#/$defs/atom_id"
        },
        "kind": {
          "$ref": "#/$defs/edge_kind"
        },
        "symbol": {
          "type": [
            "string",
            "null"
          ]
        },
        "source": {
          "type": "string",
          "enum": [
            "static",
            "verification"
          ]
        }
      }
    }
  }
},
  "plan.schema.json": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://raw.githubusercontent.com/edish-github/Cleave/main/schemas/plan.schema.json",
  "title": "Plan",
  "description": "plan.vN.json: one version of the layer plan. Bob proposes and revises plans only through the Cleave MCP tools; the engine checks each version and records its violations.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "version",
    "author",
    "layers",
    "violations"
  ],
  "properties": {
    "version": {
      "type": "integer",
      "minimum": 0
    },
    "author": {
      "type": "string",
      "enum": [
        "bob",
        "engine"
      ]
    },
    "reason": {
      "type": [
        "string",
        "null"
      ],
      "description": "Why this version exists, e.g. the failing test that caused an atom move."
    },
    "layers": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/$defs/layer"
      }
    },
    "labels": {
      "type": [
        "object",
        "null"
      ],
      "description": "Concern label and intent per atom id, from the explore subagents.",
      "additionalProperties": {
        "$ref": "#/$defs/label"
      }
    },
    "violations": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/violation"
      }
    }
  },
  "$defs": {
    "layer": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "name",
        "atoms"
      ],
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 80
        },
        "rationale": {
          "type": [
            "string",
            "null"
          ]
        },
        "atoms": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "./atom.schema.json#/$defs/atom_id"
          }
        }
      }
    },
    "label": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "concern",
        "intent"
      ],
      "properties": {
        "concern": {
          "type": "string",
          "maxLength": 60
        },
        "intent": {
          "type": "string",
          "maxLength": 200
        }
      }
    },
    "violation": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "detail"
      ],
      "properties": {
        "kind": {
          "type": "string",
          "enum": [
            "missing_atom",
            "duplicate_atom",
            "unknown_atom",
            "order",
            "group_split",
            "empty_layer",
            "layer_too_large"
          ]
        },
        "atom": {
          "type": [
            "string",
            "null"
          ]
        },
        "layer": {
          "type": [
            "integer",
            "null"
          ],
          "minimum": 1
        },
        "detail": {
          "type": "string"
        }
      }
    }
  }
},
  "report.schema.json": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://raw.githubusercontent.com/edish-github/Cleave/main/schemas/report.schema.json",
  "title": "Report",
  "description": "report.json: the outcome of one run. The overview, the proof page and /results all read the checks from here.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "version",
    "run_id",
    "status",
    "command",
    "base_sha",
    "head_sha",
    "head_tree",
    "top_tree",
    "foreign_lines",
    "plan_version",
    "checks",
    "layers",
    "rounds",
    "repairs",
    "hook",
    "started_at",
    "finished_at"
  ],
  "properties": {
    "version": {
      "const": 1
    },
    "run_id": {
      "$ref": "#/$defs/run_id"
    },
    "status": {
      "type": "string",
      "enum": [
        "verified",
        "review",
        "failed"
      ],
      "description": "verified: all five checks pass. review: a layer can't pass on its own after the repair limit. failed: the run stopped with an error."
    },
    "error": {
      "type": [
        "string",
        "null"
      ]
    },
    "command": {
      "type": "string",
      "description": "Check command every layer ran, e.g. `pytest -q`."
    },
    "setup_command": {
      "type": [
        "string",
        "null"
      ]
    },
    "working_directory": {
      "type": [
        "string",
        "null"
      ]
    },
    "base_sha": {
      "$ref": "./atom.schema.json#/$defs/sha"
    },
    "head_sha": {
      "$ref": "./atom.schema.json#/$defs/sha"
    },
    "head_tree": {
      "$ref": "./atom.schema.json#/$defs/sha"
    },
    "top_tree": {
      "type": [
        "string",
        "null"
      ],
      "pattern": "^[0-9a-f]{40}$",
      "description": "Tree of the last layer. Equal to head_tree when fidelity holds."
    },
    "foreign_lines": {
      "type": "integer",
      "minimum": 0,
      "description": "Lines in the stack that are not in the original diff. Must be 0."
    },
    "plan_version": {
      "type": "integer",
      "minimum": 0,
      "description": "The plan version this report verifies."
    },
    "checks": {
      "type": "array",
      "minItems": 5,
      "maxItems": 5,
      "items": {
        "$ref": "#/$defs/check"
      }
    },
    "layers": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/layer_result"
      }
    },
    "rounds": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/round"
      }
    },
    "repairs": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/repair"
      }
    },
    "issue": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "#/$defs/issue"
        }
      ]
    },
    "hook": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "allowed",
        "blocked"
      ],
      "properties": {
        "allowed": {
          "type": "integer",
          "minimum": 0
        },
        "blocked": {
          "type": "integer",
          "minimum": 0
        }
      }
    },
    "bob": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "#/$defs/bob_stats"
        }
      ]
    },
    "publish": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "#/$defs/publish"
        }
      ]
    },
    "started_at": {
      "type": "string",
      "format": "date-time"
    },
    "finished_at": {
      "type": "string",
      "format": "date-time"
    }
  },
  "$defs": {
    "run_id": {
      "type": "string",
      "pattern": "^[a-z0-9][a-z0-9-]{5,63}$"
    },
    "check_id": {
      "type": "string",
      "enum": [
        "coverage",
        "order",
        "fidelity",
        "shippability",
        "partition"
      ],
      "description": "coverage: every atom in exactly one layer. order: no edge points to a later layer. fidelity: top tree = head tree. shippability: every prefix passes the check command. partition: no new code (foreign_lines = 0, no source edit allowed by the hook)."
    },
    "check": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "status",
        "value",
        "detail"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/check_id"
        },
        "status": {
          "type": "string",
          "enum": [
            "pass",
            "attention"
          ]
        },
        "value": {
          "type": "string",
          "description": "Short value shown beside the check, e.g. `37 / 37` or `Identical`."
        },
        "detail": {
          "type": "string",
          "description": "One line of evidence."
        }
      }
    },
    "layer_result": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "index",
        "name",
        "atoms",
        "added",
        "removed",
        "files",
        "branch",
        "status"
      ],
      "properties": {
        "index": {
          "type": "integer",
          "minimum": 1
        },
        "name": {
          "type": "string"
        },
        "rationale": {
          "type": [
            "string",
            "null"
          ]
        },
        "atoms": {
          "type": "array",
          "items": {
            "$ref": "./atom.schema.json#/$defs/atom_id"
          }
        },
        "added": {
          "type": "integer",
          "minimum": 0
        },
        "removed": {
          "type": "integer",
          "minimum": 0
        },
        "files": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "branch": {
          "type": "string",
          "description": "cleave/<slug>/<index>-<layer-slug>"
        },
        "commit_sha": {
          "type": [
            "string",
            "null"
          ],
          "pattern": "^[0-9a-f]{40}$"
        },
        "tree_sha": {
          "type": [
            "string",
            "null"
          ],
          "pattern": "^[0-9a-f]{40}$"
        },
        "status": {
          "type": "string",
          "enum": [
            "pass",
            "fail"
          ]
        },
        "tests_passed": {
          "type": [
            "integer",
            "null"
          ],
          "minimum": 0
        },
        "tests_failed": {
          "type": [
            "integer",
            "null"
          ],
          "minimum": 0
        },
        "duration_ms": {
          "type": [
            "integer",
            "null"
          ],
          "minimum": 0
        },
        "description": {
          "type": [
            "string",
            "null"
          ],
          "description": "Pull request text for this layer."
        }
      }
    },
    "round": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "round",
        "plan_version",
        "results"
      ],
      "properties": {
        "round": {
          "type": "integer",
          "minimum": 1
        },
        "plan_version": {
          "type": "integer",
          "minimum": 0
        },
        "results": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/check_result"
          }
        }
      }
    },
    "check_result": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "layer",
        "status",
        "duration_ms"
      ],
      "properties": {
        "layer": {
          "type": "integer",
          "minimum": 1
        },
        "status": {
          "type": "string",
          "enum": [
            "pass",
            "fail",
            "error",
            "timeout"
          ]
        },
        "tests_passed": {
          "type": [
            "integer",
            "null"
          ],
          "minimum": 0
        },
        "tests_failed": {
          "type": [
            "integer",
            "null"
          ],
          "minimum": 0
        },
        "duration_ms": {
          "type": "integer",
          "minimum": 0
        },
        "failure": {
          "oneOf": [
            {
              "type": "null"
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "test",
                "message"
              ],
              "properties": {
                "test": {
                  "type": "string"
                },
                "message": {
                  "type": "string"
                }
              }
            }
          ]
        },
        "log_excerpt": {
          "type": [
            "string",
            "null"
          ],
          "maxLength": 8000
        }
      }
    },
    "repair": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "round",
        "atom",
        "from_layer",
        "to_layer",
        "reason"
      ],
      "properties": {
        "round": {
          "type": "integer",
          "minimum": 1,
          "description": "The round that verified this repair."
        },
        "atom": {
          "$ref": "./atom.schema.json#/$defs/atom_id"
        },
        "from_layer": {
          "type": "integer",
          "minimum": 1
        },
        "to_layer": {
          "type": "integer",
          "minimum": 1
        },
        "reason": {
          "type": "string"
        }
      }
    },
    "issue": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "layer",
        "test",
        "expected",
        "found",
        "explanation",
        "resolution"
      ],
      "properties": {
        "layer": {
          "type": "integer",
          "minimum": 1
        },
        "test": {
          "type": "string"
        },
        "expected": {
          "type": "string"
        },
        "found": {
          "type": "string"
        },
        "log_excerpt": {
          "type": [
            "string",
            "null"
          ],
          "maxLength": 8000
        },
        "explanation": {
          "type": "string"
        },
        "resolution": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "into",
            "from",
            "name"
          ],
          "properties": {
            "kind": {
              "const": "merge"
            },
            "into": {
              "type": "integer",
              "minimum": 1
            },
            "from": {
              "type": "integer",
              "minimum": 1
            },
            "name": {
              "type": "string"
            }
          }
        }
      }
    },
    "bob_stats": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "surface",
        "mode"
      ],
      "properties": {
        "surface": {
          "type": "string",
          "enum": [
            "ide",
            "bob_run"
          ]
        },
        "mode": {
          "type": "string"
        },
        "task_id": {
          "type": [
            "string",
            "null"
          ]
        },
        "bobcoins": {
          "type": [
            "number",
            "null"
          ],
          "minimum": 0
        },
        "tokens": {
          "type": [
            "integer",
            "null"
          ],
          "minimum": 0
        },
        "tool_calls": {
          "type": [
            "integer",
            "null"
          ],
          "minimum": 0
        },
        "mcp_calls": {
          "type": [
            "integer",
            "null"
          ],
          "minimum": 0
        },
        "subagents": {
          "type": [
            "integer",
            "null"
          ],
          "minimum": 0
        },
        "duration_ms": {
          "type": [
            "integer",
            "null"
          ],
          "minimum": 0
        }
      }
    },
    "publish": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "published_at",
        "method",
        "pull_requests"
      ],
      "properties": {
        "published_at": {
          "type": "string",
          "format": "date-time"
        },
        "method": {
          "type": "string",
          "enum": [
            "stacked",
            "chained"
          ]
        },
        "pull_requests": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "layer",
              "number",
              "url",
              "base"
            ],
            "properties": {
              "layer": {
                "type": "integer",
                "minimum": 1
              },
              "number": {
                "type": "integer",
                "minimum": 1
              },
              "url": {
                "type": "string",
                "format": "uri"
              },
              "base": {
                "type": "string"
              }
            }
          }
        }
      }
    }
  }
},
} as const;
