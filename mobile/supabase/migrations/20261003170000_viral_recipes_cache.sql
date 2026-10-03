-- Viral recipe link-out shelf (YouTube metadata only — no shared recipe text)

create table if not exists public.viral_recipes_cache_meta (
  id smallint primary key default 1 check (id = 1),
  refreshed_at timestamptz not null default '1970-01-01'::timestamptz
);

insert into public.viral_recipes_cache_meta (id, refreshed_at)
values (1, '1970-01-01'::timestamptz)
on conflict (id) do nothing;

create table if not exists public.viral_recipe_links (
  video_id text primary key,
  category text not null check (category in ('viral', 'quick', 'budget')),
  title text not null,
  thumbnail_url text not null,
  channel_id text not null,
  channel_title text not null,
  channel_url text not null,
  watch_url text not null,
  view_count bigint not null default 0,
  published_at timestamptz,
  sort_rank int not null default 0,
  cached_at timestamptz not null default now()
);

create index if not exists viral_recipe_links_category_rank_idx
  on public.viral_recipe_links (category, sort_rank);

alter table public.viral_recipes_cache_meta enable row level security;
alter table public.viral_recipe_links enable row level security;

drop policy if exists viral_recipes_cache_meta_read on public.viral_recipes_cache_meta;
create policy viral_recipes_cache_meta_read on public.viral_recipes_cache_meta
  for select using (true);

drop policy if exists viral_recipe_links_read on public.viral_recipe_links;
create policy viral_recipe_links_read on public.viral_recipe_links
  for select using (true);
