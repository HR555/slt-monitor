# Worker + D1 Database

Cloudflare Worker that polls the SLT UsageSummary API, stores hourly snapshots in a D1 database, and exposes lightweight endpoints for manual triggering and historical queries.

## Prerequisites

- Cloudflare account with Workers + D1 enabled
- An SLT account that can access the UsageSummary API
- `wrangler` CLI (installed via `npm install -g wrangler` or `npx wrangler`)

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create the D1 database**
   ```bash
   wrangler d1 create slt-usage-reports
   ```
   Copy the generated `database_id` and update `wrangler.toml`.

3. **Run the migration**
   ```bash
   npm run migrate
   ```

4. **Configure secrets**
   ```bash
   wrangler secret put SLT_AUTH_TOKEN
   ```
   Optional (overrides default): `wrangler secret put SLT_USER_AGENT`

The non-secret subscriber ID lives in `wrangler.toml` under `[vars]`.

## Development

```bash
npm run dev
```

This starts the Worker locally with a D1 Dev instance.

## Deployment

```bash
npm run deploy
```

When pushed to `main`, GitHub Actions executes the same command. Add the following repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Endpoints

- `GET /usage?days=7` – Returns stored rows within the past _n_ days.
- `POST/GET /trigger` – Fire the SLT request immediately and persist the result.
- `GET /health` – Simple health check.

The cron trigger defined in `wrangler.toml` runs every hour (`0 * * * *`) to capture usage without manual intervention.
