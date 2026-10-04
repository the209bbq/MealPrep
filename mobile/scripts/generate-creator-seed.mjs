#!/usr/bin/env node
/**
 * Regenerate recipe_creators seed migration from supabase/seed-data/youtube_cooking_creators.json.
 * `source` values: top25, below_cutoff, david_pick, intl_added (see recipe_creators_source_check).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const jsonPath = path.join(root, 'supabase/seed-data/youtube_cooking_creators.json');
const outPath = path.join(root, 'supabase/migrations/20261004130000_recipe_creators_seed.sql');

function parseSub(raw) {
  const trimmed = String(raw).trim();
  const match = trimmed.match(/^([\d,.]+)\s*([KMB])?$/i);
  if (!match) return 0;
  let n = Number.parseFloat(match[1].replace(/,/g, ''));
  const u = (match[2] || '').toUpperCase();
  if (u === 'K') n *= 1e3;
  else if (u === 'M') n *= 1e6;
  else if (u === 'B') n *= 1e9;
  return Math.round(n);
}

function sqlStr(v) {
  if (v == null) return 'null';
  return `'${String(v).replace(/'/g, "''")}'`;
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const values = data.map((row) => {
  const subs = parseSub(row.subscribers);
  const notes = row.fitReason ? row.fitReason : null;
  return `  (
    ${sqlStr(row.channelId)},
    ${sqlStr(row.name)},
    ${sqlStr(row.handle)},
    ${sqlStr(row.url)},
    ${subs},
    ${row.totalViews ?? 0},
    ${row.medianViews ?? 0},
    ${row.medianLikes ?? 0},
    ${row.rank},
    ${sqlStr(row.fit)},
    ${sqlStr(row.source)},
    true,
    ${notes ? sqlStr(notes) : 'null'}
  )`;
});

const sql = `-- Seed trusted food creators (${data.length} channels). Stats refreshed from YouTube API via creator-videos.

insert into public.recipe_creators (
  youtube_channel_id,
  display_name,
  handle,
  channel_url,
  subscriber_count,
  total_views,
  avg_views,
  avg_likes,
  rank,
  fit,
  source,
  enabled,
  notes
) values
${values.join(',\n')}
on conflict (youtube_channel_id) do update set
  display_name = excluded.display_name,
  handle = excluded.handle,
  channel_url = excluded.channel_url,
  subscriber_count = excluded.subscriber_count,
  total_views = excluded.total_views,
  avg_views = excluded.avg_views,
  avg_likes = excluded.avg_likes,
  rank = excluded.rank,
  fit = excluded.fit,
  source = excluded.source,
  enabled = excluded.enabled,
  notes = excluded.notes,
  updated_at = now();
`;

fs.writeFileSync(outPath, sql);
console.log(`Wrote ${outPath} (${data.length} creators)`);
