"""Tiny git repositories built in temp dirs, so every spec runs anywhere in seconds."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

import pytest

SCHEMAS = Path(__file__).resolve().parents[3] / "schemas"
BOB_CONFIG = Path(__file__).resolve().parents[1] / "src" / "cleave" / "bob_config"


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True, text=True).stdout.strip()


@dataclass
class FixtureRepo:
    path: Path
    base: str
    head: str

    def tree(self, ref: str) -> str:
        return git(self.path, "rev-parse", f"{ref}^{{tree}}")

    def status(self) -> str:
        return git(self.path, "status", "--porcelain", "--untracked-files=all")


FileMap = dict[str, "str | bytes | None"]


def _write(root: Path, files: FileMap) -> None:
    for rel, content in files.items():
        path = root / rel
        if content is None:
            path.unlink()
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, bytes):
            path.write_bytes(content)
        else:
            path.write_text(content)


def make_repo(root: Path, base: FileMap, head: FileMap, renames: dict[str, str] | None = None) -> FixtureRepo:
    root.mkdir(parents=True, exist_ok=True)
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "fixtures@cleave.test")
    git(root, "config", "user.name", "Cleave Fixtures")
    git(root, "config", "commit.gpgsign", "false")
    _write(root, base)
    git(root, "add", "-A")
    git(root, "commit", "-q", "-m", "base")
    base_sha = git(root, "rev-parse", "HEAD")
    for old, new in (renames or {}).items():
        (root / new).parent.mkdir(parents=True, exist_ok=True)
        git(root, "mv", old, new)
    _write(root, head)
    git(root, "add", "-A")
    git(root, "commit", "-q", "-m", "head")
    head_sha = git(root, "rev-parse", "HEAD")
    return FixtureRepo(root, base_sha, head_sha)


# A small Python service. The head adds loyalty tiers across models, a new module,
# a service call, a pytest fixture and tests; it also deletes, renames and adds a binary.

BASE_FILES: FileMap = {
    "app/__init__.py": "",
    "app/models.py": (
        "from dataclasses import dataclass\n\n\n"
        "@dataclass\n"
        "class User:\n"
        "    id: int\n"
        "    name: str\n\n\n"
        "@dataclass\n"
        "class Booking:\n"
        "    id: int\n"
        "    user_id: int\n"
        "    price: float\n"
    ),
    "app/service.py": (
        "from app.models import Booking\n\n\n"
        "def total(bookings: list[Booking]) -> float:\n"
        "    return sum(b.price for b in bookings)\n\n\n"
        "def describe(booking: Booking) -> str:\n"
        "    return f\"Booking {booking.id}\"\n"
    ),
    "app/legacy.py": "def old_helper():\n    return 1\n",
    "app/notes.txt": "keep me\n",
    "tests/__init__.py": "",
    "tests/conftest.py": (
        "import pytest\n\n"
        "from app.models import Booking\n\n\n"
        "@pytest.fixture\n"
        "def booking():\n"
        "    return Booking(id=1, user_id=1, price=100.0)\n"
    ),
    "tests/test_service.py": (
        "from app.service import total\n\n\n"
        "def test_total(booking):\n"
        "    assert total([booking]) == 100.0\n"
    ),
}

HEAD_FILES: FileMap = {
    "app/models.py": (
        "from dataclasses import dataclass\n"
        "from enum import Enum\n\n\n"
        "class Tier(str, Enum):\n"
        "    BRONZE = \"bronze\"\n"
        "    GOLD = \"gold\"\n\n\n"
        "@dataclass\n"
        "class User:\n"
        "    id: int\n"
        "    name: str\n"
        "    tier: Tier = Tier.BRONZE\n\n\n"
        "@dataclass\n"
        "class Booking:\n"
        "    id: int\n"
        "    user_id: int\n"
        "    price: float\n"
    ),
    "app/loyalty.py": (
        "from app.models import Tier\n\n"
        "RATES = {Tier.BRONZE: 1, Tier.GOLD: 3}\n\n\n"
        "def points_for(tier: Tier, price: float) -> int:\n"
        "    return int(price) * RATES[tier]\n"
    ),
    "app/service.py": (
        "from app.loyalty import points_for\n"
        "from app.models import Booking, Tier\n\n\n"
        "def total(bookings: list[Booking]) -> float:\n"
        "    return sum(b.price for b in bookings)\n\n\n"
        "def describe(booking: Booking) -> str:\n"
        "    return f\"Booking {booking.id}\"\n\n\n"
        "def earned(booking: Booking, tier: Tier) -> int:\n"
        "    return points_for(tier, booking.price)\n"
    ),
    "app/legacy.py": None,
    "app/logo.bin": b"\x89PNG\x00\x01\x02\x03binary",
    "tests/conftest.py": (
        "import pytest\n\n"
        "from app.models import Booking, Tier, User\n\n\n"
        "@pytest.fixture\n"
        "def booking():\n"
        "    return Booking(id=1, user_id=1, price=100.0)\n\n\n"
        "@pytest.fixture\n"
        "def gold_member():\n"
        "    return User(id=2, name=\"Ada\", tier=Tier.GOLD)\n"
    ),
    "tests/test_loyalty.py": (
        "from app.service import earned\n\n\n"
        "def test_gold_earns_triple(booking, gold_member):\n"
        "    assert earned(booking, gold_member.tier) == 300\n"
    ),
}

RENAMES = {"app/notes.txt": "docs/notes.txt"}


@pytest.fixture
def repo(tmp_path: Path) -> FixtureRepo:
    return make_repo(tmp_path / "service", BASE_FILES, HEAD_FILES, RENAMES)


@pytest.fixture
def schemas() -> Path:
    return SCHEMAS
