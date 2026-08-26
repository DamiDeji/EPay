# EPay Live Testnet Demo — Runbook

Goal: give reviewers a demo they can **interact with** — sign up, log in, create a
payment — against Stellar testnet, rather than just read the code.

## Current state (August 2026)

| Component | Status |
|-----------|--------|
| 12 Soroban contracts | ✅ Deployed to Stellar testnet (`DEPLOYMENTS.md`, `.env.example`) |
| Web app (`apps/web`) | ✅ Live on Vercel (`https://epay-web-teal.vercel.app`) |
| Merchant dashboard | ✅ Live on Vercel (`https://epay-merchant.vercel.app`) |
| Admin dashboard | ✅ Live on Vercel (`https://epay-admin-two.vercel.app`) |
| API (`apps/api`) | ❌ Not publicly hosted — dashboards call `http://localhost:4000` by default |
| Indexer (`apps/indexer`) | ❌ Not running anywhere |
| Postgres + Redis | ❌ Local-only (docker-compose) |

**The one thing blocking an interactive demo is a hosted API** (+ its database and
Redis), wired to the existing Vercel deployments via `NEXT_PUBLIC_API_URL`.

## Recommended stack

| Piece | Provider | Why |
|-------|----------|-----|
| Postgres | **Neon** (serverless Postgres, free tier) | Free tier, connection string drop-in for Prisma |
| Redis (BullMQ) | **Upstash** (serverless Redis, free tier) | Free tier; standard Redis protocol works with BullMQ |
| API process | **Railway / Render / Fly.io** (Docker) | Long-running Fastify/NestJS server — not a Vercel fit |
| Indexer worker | Same host as API (separate service) | Long-running BullMQ worker + Horizon scanner |
| Frontends | Vercel (already in place) | Add `NEXT_PUBLIC_API_URL` env var |

> Fly.io and Render both have generous free/cheap tiers for small containers; check
> current pricing before committing. The repo ships production Dockerfiles
> (`infra/docker/Dockerfile.api`, `Dockerfile.indexer`, `Dockerfile.web`) and a
> `docker-compose.yml` that mirrors this topology — reuse them.

## Step 1 — Provision Postgres (Neon)

1. Create a project at neon.tech (free tier is fine).
2. Copy the pooled connection string (`postgresql://...?...sslmode=require`).
3. Save it as `DATABASE_URL`.

## Step 2 — Provision Redis (Upstash)

1. Create a Redis database at upstash.com (free tier).
2. Copy the **connection string** (`rediss://default:<token>@...`). Upstash REST-only
   URLs don't speak the raw Redis protocol BullMQ needs — use the TLS connection
   string form.
3. Save it as `REDIS_URL`.

## Step 3 — Deploy the API

1. Push the repo to a Git provider and import it into Railway/Render/Fly.
2. Use `infra/docker/Dockerfile.api` (already builds NestJS + runs migrations).
3. Set environment variables (all values already exist in `.env.example`):

   ```env
   NODE_ENV=production
   PORT=4000
   DATABASE_URL=<neon pooled url>
   REDIS_URL=<upstash connection string>
   JWT_SECRET=<32+ random chars>
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   STELLAR_NETWORK=testnet
   STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
   STELLAR_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
   CORS_ORIGINS=https://epay-web-teal.vercel.app,https://epay-merchant.vercel.app,https://epay-admin-two.vercel.app
   # plus the 12 *_CONTRACT_ID values from .env.example
   ```

4. Health check: `curl https://<your-api-url>/health` → `200`.

## Step 4 — Deploy the indexer

1. Add a second service on the same host using `infra/docker/Dockerfile.indexer`.
2. Same env vars as the API (it needs the DB, Redis, and Stellar endpoints) plus:

   ```env
   INDEXER_POLL_INTERVAL_MS=10000
   INDEXER_BATCH_SIZE=100
   INDEXER_CONFIRMATION_LEDGERS=12
   INDEXER_REALTIME_ENABLED=true
   INDEXER_HISTORICAL_ENABLED=true
   ```

3. Verify logs show ledger scanning without consecutive failures.

## Step 5 — Point the frontends at the API

On Vercel, for **each** of the three projects set:

```env
NEXT_PUBLIC_API_URL=https://<your-api-url>
NEXT_PUBLIC_STELLAR_NETWORK=testnet
```

Redeploy (or merge to the production branch). The dashboards now talk to the live API.

## Step 6 — Seed demo data

```bash
pnpm --filter @epay/database prisma:migrate
pnpm --filter @epay/database prisma:seed
```

Create two or three demo merchants with testnet wallets so reviewers can log in with a
demo account (see `apps/api/src/auth` for the wallet-auth flow, or the seed script for
default users). Document demo credentials in the README demo section.

## Step 7 — Smoke test (manual)

```bash
# 1. Health
curl -s https://<api>/health

# 2. Register a demo user
curl -s -X POST https://<api>/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@epay.dev","password":"..."}'

# 3. Login → token
curl -s -X POST https://<api>/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@epay.dev","password":"..."}'

# 4. Create a payment with the token (JWT)
curl -s -X POST https://<api>/payments \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"amount":"10000000","asset":"native","recipient":"<testnet G...>"}'

# 5. Open the dashboard and confirm the payment appears (indexer + API + UI path)
```

## Reviewer experience checklist

- [ ] Landing page loads with correct Stellar branding (no TON references).
- [ ] Register/login works against the hosted API.
- [ ] A payment created in the UI shows up in Payments and Analytics.
- [ ] Wallet flow works with **Freighter on testnet** (or a documented mock).
- [ ] Swagger at `https://<api>/api/docs` is reachable.
- [ ] README "Live Demo" links point at the right URLs.

## Known gaps that don't block a demo

- **Real on-chain payments from the UI**: the web app registers/logs in via the API;
  actually funding a Soroban escrow requires a wallet (Freighter) on testnet with test
  XLM (friendbot). Decide whether the demo targets wallet-based flows or API-driven
  flows and say so in the README.
- **Social preview**: no og:image exists yet — see contributor issue #9.
- **Rate limiting / abuse protection** on public endpoints is partial (contributor
  issue in `docs/CONTRIBUTOR_ISSUES.md` backlog; also #11 in `docs/WAVE_ISSUES.md`).
