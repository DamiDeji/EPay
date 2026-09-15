# Getting Started

Get EPay running locally in about five minutes, then poke at it with the API docs,
the SDK, and the dashboards.

## Two ways to run it

| Path                                                       | Time   | Use it for                                                     |
| ---------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| **[Docker Compose](#option-a-docker-compose-recommended)** | ~3 min | A full stack — API, indexer, three dashboards, Postgres, Redis |
| **[Local processes](#option-b-local-processes)**           | ~5 min | Editing code with hot reload                                   |

---

## Option A: Docker Compose (recommended)

**Prerequisites:** Docker with Compose v2. Nothing else — no Node, no Rust.

```bash
git clone https://github.com/DamiDeji/EPay.git
cd EPay
cp .env.example .env

# 1. Start Postgres and Redis.
docker compose up -d postgres redis

# 2. Apply migrations and seed testnet sample data (runs once, then exits).
docker compose --profile setup up db-migrate

# 3. Start API, indexer, and the three dashboards.
docker compose up -d api indexer web merchant-dashboard admin-dashboard
```

Wait ~30 seconds for the API health check to pass, then open:

| Service            | URL                            |
| ------------------ | ------------------------------ |
| API                | http://localhost:4000          |
| API docs (Swagger) | http://localhost:4000/api/docs |
| Customer web app   | http://localhost:3000          |
| Merchant dashboard | http://localhost:3001          |
| Admin dashboard    | http://localhost:3002          |

Confirm it is alive:

```bash
curl -s http://localhost:4000/health | jq
# { "status": "ok", "info": { "database": { "status": "up" }, ... } }

curl -s http://localhost:4000/metrics | head -5
# # HELP epay_http_requests_total ...
```

Stop everything:

```bash
docker compose down          # keep the database volume
docker compose down -v       # wipe it and start over
```

---

## Option B: Local processes

**Prerequisites**

- **Node.js ≥ 20** and **pnpm ≥ 9** (`corepack enable` will provide pnpm)
- **PostgreSQL ≥ 15** and **Redis ≥ 7** running locally
- **Rust ≥ 1.89** — only needed to build or test the Soroban contracts

```bash
git clone https://github.com/DamiDeji/EPay.git
cd EPay
pnpm install

cp .env.example .env
# Point DATABASE_URL and REDIS_URL at your local instances.

pnpm --filter @epay/database prisma:generate
pnpm --filter @epay/database prisma:migrate
pnpm --filter @epay/database prisma:seed
```

Start what you need, each in its own terminal:

```bash
pnpm --filter @epay/api dev                  # http://localhost:4000
pnpm --filter @epay/web dev                  # http://localhost:3000
pnpm --filter @epay/merchant-dashboard dev   # http://localhost:3001
pnpm --filter @epay/admin-dashboard dev      # http://localhost:3002
pnpm --filter @epay/indexer dev              # Stellar indexer (no HTTP port)
```

`pnpm dev` at the root starts everything through Turborepo at once.

---

## Prove it works

### 1. Sign in

The seed script creates test accounts. Use one from `packages/database/prisma/seed.ts`,
or register a new user at http://localhost:3000/register.

### 2. Call the API

```bash
# Log in and capture a token.
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"merchant@epay.dev","password":"password123"}' | jq -r .data.accessToken)

# Ask who you are.
curl -s http://localhost:4000/auth/me -H "Authorization: Bearer $TOKEN" | jq
```

Every request returns an `x-request-id` header. Quote it when reporting a problem —
it correlates the API's logs with the error report.

### 3. Use the SDK

```bash
pnpm --filter @epay/sdk build
node -e "
  const { EPayClient } = require('./packages/sdk/dist/index.js');
  const client = new EPayClient({ baseUrl: 'http://localhost:4000', apiKey: process.env.EPAY_API_KEY });
  client.health().then(console.log);
"
```

Full examples are in [`packages/sdk/README.md`](../packages/sdk/README.md).

### 4. Run the tests

```bash
pnpm test          # every package
pnpm typecheck     # every package
pnpm lint
```

Contracts need Rust:

```bash
cargo test --manifest-path packages/contracts/Cargo.toml
```

---

## The indexer needs no setup

On first boot the indexer backfills from the configured start ledger and then
switches to real-time. Give it a minute and watch the log line reporting the
checkpoint advance.

It is observable, not decorative: `curl localhost:4100/metrics` reports the
ledger lag, and `/health` and `/ready` answer liveness and readiness. Its records
are **not** projected into the API's read model, so the dashboards are not
populated by it — [`INDEXER.md`](./INDEXER.md) explains that gap and why it
exists.

If the indexer appears stuck, it is almost always Soroban RPC connectivity:
`docker compose logs -f indexer`.

---

## Troubleshooting

| Symptom                                 | Likely cause                             | Fix                                            |
| --------------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| `pnpm install` fails on a native module | Node version too old                     | Use Node 20+; `node --version`                 |
| `prisma migrate` can't connect          | Postgres not up, or wrong `DATABASE_URL` | `docker compose up -d postgres`, check `.env`  |
| API 502s / health check red             | migrations not applied                   | `docker compose --profile setup up db-migrate` |
| API starts, every request hangs         | Redis missing — BullMQ blocks on connect | `docker compose up -d redis`                   |
| Indexer logs RPC errors                 | Soroban RPC unreachable                  | check `STELLAR_SOROBAN_RPC_URL`                |
| `@epay/hooks` fails to build            | stale `tsbuildinfo`                      | `pnpm clean && pnpm build`                     |

### Known issues

Open items are tracked in one place — the
[ROADMAP](../ROADMAP.md#known-issues) — so this document cannot drift out of
date. Nothing listed there blocks a local run.

---

## Next steps

- [`architecture.md`](./architecture.md) — how the pieces fit together and why
- [`contract-integration.md`](./contract-integration.md) — build an integration
- [`webhook-receiver.md`](./webhook-receiver.md) — receive events
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — before you open a PR
