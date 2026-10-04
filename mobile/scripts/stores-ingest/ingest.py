#!/usr/bin/env python3
"""Ingest US grocery stores from Overture Places GeoParquet into Supabase `public.stores`."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import textwrap
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Any, Iterable, Optional

import duckdb
import requests

S3_BUCKET = "s3://overturemaps-us-west-2"
USER_AGENT = "MealPlanatic-stores-ingest/1.0 (https://github.com/the209bbq/MealPrep)"

GROCERY_CATEGORIES = {
    "grocery_store",
    "supermarket",
    "health_food_store",
    "international_grocery",
    "specialty_grocery",
    "ethnic_grocery",
    "butcher",
    "produce",
    "greengrocer",
    "warehouse_club",
}

BIGBOX_NAME_PATTERNS = [
    re.compile(r"walmart supercenter", re.I),
    re.compile(r"\btarget\b", re.I),
    re.compile(r"\bcostco\b", re.I),
    re.compile(r"sam'?s club", re.I),
    re.compile(r"\bwinco\b", re.I),
    re.compile(r"dollar general market", re.I),
]

NAME_EXCLUDE = re.compile(
    r"\b(cigarette|cigarettes|tobacco|smoke shop|beer wine|wine & gas|wine & spirits|liquor|vape|"
    r"extramile|extra mile|amar beer|quick stop|quik stop|speedway|love'?s|flyers|mine-mart|"
    r"fast & easy mart|five star food|wine vinegar|rocket|convenience|gas station|fuel)\b",
    re.I,
)

DISALLOWED_CATEGORIES = {
    "convenience_store",
    "gas_station",
    "liquor_store",
    "tobacco_shop",
    "vape_shop",
}


def latest_overture_release() -> str:
    url = (
        "https://overturemaps-us-west-2.s3.amazonaws.com/"
        "?list-type=2&prefix=release/&delimiter=/"
    )
    resp = requests.get(url, timeout=60, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    root = ET.fromstring(resp.content)
    ns = {"s3": "http://s3.amazonaws.com/doc/2006-03-01/"}
    prefixes = [
        p.find("s3:Prefix", ns).text
        for p in root.findall("s3:CommonPrefixes", ns)
        if p.find("s3:Prefix", ns) is not None
    ]
    releases = sorted(p.rstrip("/").split("/")[-1] for p in prefixes if p)
    if not releases:
        raise RuntimeError("Could not list Overture releases on S3")
    return releases[-1]


def places_glob(release: str) -> str:
    return f"{S3_BUCKET}/release/{release}/theme=places/type=place/*"


def name_allowed(name: str) -> bool:
    if not name or not name.strip():
        return False
    if NAME_EXCLUDE.search(name):
        return False
    if re.search(r"\bfood mart\b", name, re.I):
        return False
    return True


def category_allowed(category: str, name: str) -> bool:
    cat = (category or "").strip().lower()
    if cat in DISALLOWED_CATEGORIES:
        return False
    if cat in GROCERY_CATEGORIES:
        return True
    if any(p.search(name) for p in BIGBOX_NAME_PATTERNS):
        return True
    return False


def normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


@dataclass
class StoreRow:
    id: str
    name: str
    brand: Optional[str]
    category: Optional[str]
    address_line: str
    city: str
    state: str
    zip: str
    lat: float
    lng: float
    phone: Optional[str]
    website: Optional[str]
    opening_hours: Optional[str]
    sources: list[str]

    def to_sql_values(self) -> str:
        def q(v: Optional[str]) -> str:
            if v is None:
                return "NULL"
            return "'" + v.replace("'", "''") + "'"

        src = "ARRAY[" + ",".join(q(s) for s in self.sources) + "]"
        geom = f"ST_SetSRID(ST_MakePoint({self.lng}, {self.lat}), 4326)::geography"
        return (
            f"({q(self.id)}, {q(self.name)}, {q(self.brand)}, {q(self.category)}, "
            f"{q(self.address_line)}, {q(self.city)}, {q(self.state)}, {q(self.zip)}, "
            f"{self.lat}, {self.lng}, {geom}, {q(self.phone)}, {q(self.website)}, "
            f"{q(self.opening_hours)}, {src}, now())"
        )


def fetch_overture_rows(release: str, state: Optional[str]) -> list[StoreRow]:
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("INSTALL spatial; LOAD spatial;")
    glob = places_glob(release)
    state_filter = ""
    if state:
        state_filter = f"AND upper(addresses[1].region) = '{state.upper()}'"

    cat_list = ", ".join(f"'{c}'" for c in sorted(GROCERY_CATEGORIES))
    category_sql_filter = f"""
      AND (
        lower(COALESCE(taxonomy.primary, basic_category, '')) IN ({cat_list})
        OR regexp_matches(lower(names.primary), 'walmart supercenter|\\\\btarget\\\\b|costco|sam''s club|winco|dollar general market')
      )
    """

    query = f"""
    SELECT
      id,
      names.primary as name,
      COALESCE(brand.names.primary, '') as brand,
      COALESCE(taxonomy.primary, basic_category) as category,
      addresses[1].freeform as address_line,
      addresses[1].locality as city,
      addresses[1].region as state,
      addresses[1].postcode as zip,
      ST_Y(geometry) as lat,
      ST_X(geometry) as lng,
      phones[1] as phone,
      websites[1] as website,
      confidence
    FROM read_parquet('{glob}', filename=true, hive_partitioning=true)
    WHERE addresses[1].country = 'US'
      {state_filter}
      AND confidence >= 0.5
      AND names.primary IS NOT NULL
      {category_sql_filter}
    """
    raw = con.execute(query).fetchall()
    out: list[StoreRow] = []
    for row in raw:
        oid, name, brand, category, address_line, city, st, zip_code, lat, lng, phone, website, confidence = row
        name_s = str(name or "").strip()
        if not name_allowed(name_s):
            continue
        if not category_allowed(str(category or ""), name_s):
            continue
        zip_s = str(zip_code or "").strip()[:10]
        st_s = str(st or "").strip()[:2]
        out.append(
            StoreRow(
                id=f"ovt-{oid}",
                name=name_s[:200],
                brand=(brand or "").strip()[:120] or None,
                category=(str(category or "").strip()[:80] or None),
                address_line=(str(address_line or "").strip()[:240] or ""),
                city=(str(city or "").strip()[:80] or ""),
                state=st_s,
                zip=zip_s,
                lat=float(lat),
                lng=float(lng),
                phone=(str(phone).strip()[:40] if phone else None),
                website=(str(website).strip()[:500] if website else None),
                opening_hours=None,
                sources=["overture"],
            )
        )
    return out


def dedupe_nearby(rows: list[StoreRow], radius_m: float = 150.0) -> list[StoreRow]:
    kept: list[StoreRow] = []
    for row in rows:
        key = normalize_name(row.name)
        dup = False
        for k in kept:
            if normalize_name(k.name) != key:
                continue
            # rough meters via euclidean on small distances
            dlat = (row.lat - k.lat) * 111_320
            dlng = (row.lng - k.lng) * 111_320 * max(0.3, abs(__import__("math").cos(row.lat * 3.14159 / 180)))
            if (dlat * dlat + dlng * dlng) ** 0.5 <= radius_m:
                dup = True
                break
        if not dup:
            kept.append(row)
    return kept


def estimate_size_bytes(rows: list[StoreRow]) -> int:
    sample = json.dumps([r.__dict__ for r in rows[: min(50, len(rows))]])
    per = len(sample) / max(1, min(50, len(rows)))
    return int(per * len(rows))


def upsert_postgres(rows: list[StoreRow], database_url: str, batch_size: int) -> None:
    import psycopg2

    conn = psycopg2.connect(database_url)
    conn.autocommit = False
    cur = conn.cursor()
    for i in range(0, len(rows), batch_size):
        chunk = rows[i : i + batch_size]
        values = ",\n".join(r.to_sql_values() for r in chunk)
        sql = f"""
        INSERT INTO public.stores (
          id, name, brand, category, address_line, city, state, zip,
          lat, lng, geom, phone, website, opening_hours, sources, updated_at
        ) VALUES {values}
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          brand = EXCLUDED.brand,
          category = EXCLUDED.category,
          address_line = EXCLUDED.address_line,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          zip = EXCLUDED.zip,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          geom = EXCLUDED.geom,
          phone = EXCLUDED.phone,
          website = EXCLUDED.website,
          opening_hours = EXCLUDED.opening_hours,
          sources = EXCLUDED.sources,
          updated_at = now();
        """
        cur.execute(sql)
        conn.commit()
        print(f"Upserted {i + len(chunk)} / {len(rows)}", file=sys.stderr)
    cur.close()
    conn.close()


def upsert_supabase_api(rows: list[StoreRow], project_ref: str, token: str, batch_size: int) -> None:
    url = f"https://api.supabase.com/v1/projects/{project_ref}/database/query"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
    }
    for i in range(0, len(rows), batch_size):
        chunk = rows[i : i + batch_size]
        values = ",\n".join(r.to_sql_values() for r in chunk)
        query = textwrap.dedent(
            f"""
            INSERT INTO public.stores (
              id, name, brand, category, address_line, city, state, zip,
              lat, lng, geom, phone, website, opening_hours, sources, updated_at
            ) VALUES {values}
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              brand = EXCLUDED.brand,
              category = EXCLUDED.category,
              address_line = EXCLUDED.address_line,
              city = EXCLUDED.city,
              state = EXCLUDED.state,
              zip = EXCLUDED.zip,
              lat = EXCLUDED.lat,
              lng = EXCLUDED.lng,
              geom = EXCLUDED.geom,
              phone = EXCLUDED.phone,
              website = EXCLUDED.website,
              opening_hours = EXCLUDED.opening_hours,
              sources = EXCLUDED.sources,
              updated_at = now();
            """
        ).strip()
        resp = requests.post(url, headers=headers, json={"query": query}, timeout=120)
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase API error {resp.status_code}: {resp.text[:500]}")
        print(f"Upserted {i + len(chunk)} / {len(rows)}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest Overture grocery stores into Supabase")
    parser.add_argument("--release", help="Overture release id (default: latest on S3)")
    parser.add_argument("--state", help="US state code filter, e.g. CA")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--merge-osm", action="store_true", help="Optional OSM merge (not implemented in v1)")
    parser.add_argument("--mode", choices=["postgres", "supabase-api"], default="supabase-api")
    parser.add_argument("--project-ref", default=os.environ.get("SUPABASE_PROJECT_REF"))
    parser.add_argument("--batch-size", type=int, default=1000)
    args = parser.parse_args()

    if args.merge_osm:
        print("Note: --merge-osm skipped in v1 (Overture-only).", file=sys.stderr)

    release = args.release or latest_overture_release()
    print(f"Overture release: {release}", file=sys.stderr)
    rows = fetch_overture_rows(release, args.state)
    rows = dedupe_nearby(rows)
    est = estimate_size_bytes(rows)
    print(f"Rows after filter/dedupe: {len(rows)}")
    print(f"Estimated JSON payload ~{est / 1024:.1f} KiB ({est / (1024*1024):.2f} MiB)")

    if args.dry_run:
        return

    if args.mode == "postgres":
        db_url = os.environ.get("DATABASE_URL")
        if not db_url:
            raise SystemExit("DATABASE_URL required for postgres mode")
        upsert_postgres(rows, db_url, args.batch_size)
    else:
        token = os.environ.get("SUPABASE_ACCESS_TOKEN")
        ref = args.project_ref
        if not token or not ref:
            raise SystemExit("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF required for supabase-api mode")
        upsert_supabase_api(rows, ref, token, args.batch_size)


if __name__ == "__main__":
    main()
