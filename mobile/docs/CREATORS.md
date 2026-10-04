# Trusted creator recipes

MealPlanatic’s Recipes tab loads **metadata only** from a curated list of YouTube food creators (`recipe_creators` + `creator_videos`). Recipe text is never stored in the public cache; users import a video into a **private** recipe via the existing `recipe-import` edge function (creator credit + pantry match).

## Database

Apply migration:

```bash
cd mobile
supabase db push
# or run SQL from:
# supabase/migrations/20261004120000_recipe_creators.sql
```

### Seed creators

Launch list (39 channels) ships in:

`supabase/migrations/20261004130000_recipe_creators_seed.sql`

Source JSON: `supabase/seed-data/youtube_cooking_creators.json` (regenerate the seed with `node scripts/generate-creator-seed.mjs`).

Columns include `fit` (e.g. `High`, `Medium/High`, `Low/Medium`) and `source` (`top25`, `below_cutoff`, `david_pick`). Subscriber strings like `4.7M` are stored as integers. UI and feed ordering use **fit** (High → Medium → Low), then **subscriber_count** desc. Refresh updates YouTube stats only and does **not** overwrite `fit` or `source`.

### Add more creators (SQL template)

```sql
insert into public.recipe_creators (
  youtube_channel_id,
  display_name,
  handle,
  channel_url,
  subscriber_count,
  fit,
  source,
  enabled,
  rank,
  notes
) values (
  'UCxxxxxxxxxxxxxxxx',
  'Creator Display Name',
  '@handle',
  'https://www.youtube.com/@handle',
  0,
  'Medium',
  'david_pick',
  true,
  99,
  'optional notes'
);
```

Then run refresh for that handle or channel ID to pull uploads and avatars.

### Add a creator by handle only

You can insert a row with only `handle` and a placeholder `youtube_channel_id`, or skip SQL and use the refresh endpoint with `handle` — it resolves the channel via `channels.list` `forHandle` (**1 unit**) and upserts the row.

## Edge function: `creator-videos`

Deploy:

```bash
cd mobile
supabase functions deploy creator-videos
```

Secrets (Supabase project → Edge Functions → Secrets):

| Secret | Purpose |
|--------|---------|
| `YOUTUBE_API_KEY` | Same key as `recipe-import` |
| `CREATOR_ADMIN_SECRET` | Protects refresh / upsert-by-handle |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected |

Optional client override: `EXPO_PUBLIC_CREATOR_VIDEOS_URL` (defaults to `{SUPABASE_URL}/functions/v1/creator-videos`).

### Refresh cached videos (admin)

Uses **no** `search.list`. Per enabled creator, each refresh cycle uses roughly:

- `channels.list` (snippet, statistics, contentDetails) — **1 unit**
- `playlistItems.list` (up to ~50 recent uploads) — **1 unit**
- `videos.list` (stats + duration, batched) — **1 unit**

**~3 units per creator** per full refresh. For 32 creators ≈ **96 units** every 12h ≈ **192 units/day** (well under the 10,000/day free quota).

Refresh all enabled creators:

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/creator-videos" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "x-creator-admin-secret: $CREATOR_ADMIN_SECRET" \
  -d '{"action":"refresh"}'
```

Refresh / register one creator by handle:

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/creator-videos" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "x-creator-admin-secret: $CREATOR_ADMIN_SECRET" \
  -d '{"action":"refresh","handle":"@creatorhandle"}'
```

Refresh one known channel ID:

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/creator-videos" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "x-creator-admin-secret: $CREATOR_ADMIN_SECRET" \
  -d '{"action":"refresh","channelId":"UCxxxxxxxxxxxxxxxx"}'
```

Public read actions (JWT / anon): `creators`, `creator`, `feed` (`popular` | `new` | `quick` | `budget`), `search` (Postgres full-text — **no YouTube quota**).

### pg_cron (optional, ~every 12 hours)

Run in the Supabase SQL editor after enabling `pg_cron` and storing secrets in Vault or using your scheduler of choice:

```sql
-- Example: invoke refresh via pg_net (adjust URL and secret storage to your project)
select cron.schedule(
  'creator-videos-refresh-12h',
  '0 */12 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/creator-videos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY',
      'x-creator-admin-secret', 'YOUR_CREATOR_ADMIN_SECRET'
    ),
    body := '{"action":"refresh"}'::jsonb
  );
  $$
);
```

## Legacy `viral-recipes`

The old keyword-search shelf remains deployable for rollback but is **not** used by the app UI after the creator feed ships.

## Quota math (summary)

| API call | Units | Used by creator feed? |
|----------|------:|------------------------|
| `search.list` | 100 | **No** |
| `channels.list` (incl. `forHandle`) | 1 | Yes |
| `playlistItems.list` | 1 | Yes |
| `videos.list` | 1 | Yes |

At ~3 units × 32 creators × 2 refreshes/day ≈ **192 units/day** for refresh, plus occasional handle lookups when adding creators.
