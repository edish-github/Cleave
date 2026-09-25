# Cleave

Cleave is an AI-assisted stacked PR engine built for IBM Bob IDE and modern development workflows. It decomposes pull requests into verified, independent, stacked layers with zero foreign lines and bit-for-bit top tree fidelity.

## Architecture & Surfaces

- **✂ Cleave mode**: Custom mode in IBM Bob IDE.
- **Engine**: Python deterministic engine (`atomize`, `graph`, `plan`, `build`, `verify`, `report`, `publish`).
- **Web App** (`apps/web`): Interactive dashboard, stack inspector, and public verification proof pages.

## Getting Started

### Web App

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

See [apps/web/README.md](apps/web/README.md) for details.

### Research & Kill Tests

See [research/architecture.md](research/architecture.md) and [research/kill-tests/KILL_TESTS_REPORT.md](research/kill-tests/KILL_TESTS_REPORT.md).

## License

[MIT](LICENSE)
