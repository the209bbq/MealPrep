# US grocery store ingest (Overture Places → Supabase `stores`)

Loads grocery and allowed big-box locations from the public Overture Maps S3 release into `public.stores` (PostGIS). Run after applying `mobile/supabase/migrations/20261005120000_stores_postgis_nearby.sql`.

## Prerequisites

- Python 3.10+
- `pip install -r requirements.txt`
- DuckDB can read `s3://overturemaps-us-west-2/...` without AWS credentials (anonymous).

## Environment

| Variable | Used when |
|----------|-----------|
| `DATABASE_URL` | Direct Postgres upsert (`--mode postgres`) |
| `SUPABASE_ACCESS_TOKEN` | Management API (`--mode supabase-api`) |
| `SUPABASE_PROJECT_REF` | Project ref (or pass `--project-ref`) |

## Commands

**Dry run (counts + estimated JSON size, no writes):**

```bash
cd mobile/scripts/stores-ingest
python ingest.py --dry-run --state CA
python ingest.py --dry-run
```

**California test load via Supabase Management API** (recommended first):

```bash
export SUPABASE_ACCESS_TOKEN="sbp_..."
export SUPABASE_PROJECT_REF="your-project-ref"
python ingest.py --mode supabase-api --state CA
```

**Full US load:**

```bash
python ingest.py --mode supabase-api
```

**Direct Postgres** (if you have a connection string):

```bash
export DATABASE_URL="postgresql://..."
python ingest.py --mode postgres --state CA
```

### Flags

- `--release 2025-09-18.0` — Overture release folder (default: latest discovered on S3)
- `--state CA` — filter to one US state (address `region` / `country` = US)
- `--dry-run` — print row counts and approximate payload size only
- `--merge-osm` — optional OSM merge + dedupe (~150 m); off by default
- `--batch-size 1000` — upsert batch size (Supabase API)

## Monthly refresh

1. Check [Overture release notes](https://docs.overturemaps.org/release/latest/) for a new `release/YYYY-MM-DD.0` folder.
2. Run `python ingest.py --dry-run` to confirm row counts (~size on Free tier: keep lean columns only).
3. Run full `python ingest.py --mode supabase-api` (upserts by `id`).
4. Smoke-test the app Stores tab in 2–3 ZIPs.

Optional automation: a scheduled GitHub Action with `SUPABASE_ACCESS_TOKEN` secret and `workflow_dispatch` only — not included in-repo.

## Data policy

- Confidence ≥ 0.5 (Overture `confidence` score).
- Categories: grocery_store, supermarket, health_food_store, international/specialty/ethnic grocery, butcher, produce/greengrocer, warehouse_club, plus big-box allow-list (Walmart Supercenter, Target, Costco, Sam's Club, WinCo, Dollar General Market).
- Excludes convenience, gas, liquor, tobacco/vape via name/category blocklist (aligned with `mobile/lib/stores/groceryFilter.ts`).

Attribution shown in-app: OpenStreetMap contributors + Overture Maps Foundation.
