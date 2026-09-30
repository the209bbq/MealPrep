// Kroger weekly specials proxy — paste this ENTIRE file into Supabase Dashboard:
// Edge Functions → kroger-deals → Via Editor
//
// Settings: leave "Verify JWT" ENABLED (authenticated app users only).
//
// Secrets (Edge Functions → Secrets):
//   KROGER_CLIENT_ID
//   KROGER_CLIENT_SECRET
// From https://developer.kroger.com/ — application scopes: Product + Location.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const KROGER_TOKEN_URL = 'https://api.kroger.com/v1/connect/oauth2/token';
const KROGER_API = 'https://api.kroger.com/v1';

interface StoreLocation {
  id: string;
  name: string;
  chain: string;
  addressLine: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  url?: string;
}

interface GroceryItemPayload {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getKrogerToken(clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) return cachedToken.value;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'product.compact',
  });
  const basic = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(KROGER_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kroger token failed: ${response.status} ${text}`);
  }
  const json = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };
  return json.access_token;
}

function mapKrogerLocation(row: Record<string, unknown>): StoreLocation {
  const address = (row.address as Record<string, string>) ?? {};
  const geo = (row.geolocation as Record<string, number>) ?? {};
  const chain = String(row.chain ?? 'Kroger');
  const locationId = String(row.locationId ?? row.id ?? '');
  const name = String(row.name ?? chain);
  return {
    id: locationId,
    name,
    chain,
    addressLine: address.addressLine1 ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    zip: address.zipCode ?? '',
    lat: geo.latitude,
    lng: geo.longitude,
    url: `https://www.kroger.com/stores/details/${locationId}`,
  };
}

async function fetchNearbyStores(
  token: string,
  params: { lat?: number; lng?: number; zip?: string; radiusMiles?: number },
): Promise<StoreLocation[]> {
  const radius = params.radiusMiles ?? 15;
  const search = new URLSearchParams({
    'filter.radiusInMiles': String(radius),
    'filter.limit': '25',
  });
  if (params.lat != null && params.lng != null) {
    search.set('filter.latLong.near', `${params.lat},${params.lng}`);
  } else if (params.zip) {
    search.set('filter.zipCode.near', params.zip.slice(0, 5));
  } else {
    throw new Error('Provide lat/lng or zip');
  }

  const response = await fetch(`${KROGER_API}/locations?${search.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kroger locations failed: ${response.status} ${text}`);
  }
  const json = (await response.json()) as { data?: Record<string, unknown>[] };
  return (json.data ?? []).map(mapKrogerLocation);
}

function pickPrice(priceObj: Record<string, unknown> | undefined): {
  unit: number;
  promoLabel?: string;
} | null {
  if (!priceObj) return null;
  const regular = Number(priceObj.regular);
  const promo = Number(priceObj.promo);
  const hasPromo = Number.isFinite(promo) && promo > 0;
  const hasRegular = Number.isFinite(regular) && regular > 0;
  if (hasPromo && hasRegular && promo < regular) {
    return { unit: promo, promoLabel: `Sale (was $${regular.toFixed(2)})` };
  }
  if (hasPromo) return { unit: promo, promoLabel: 'Promo price' };
  if (hasRegular) return { unit: regular };
  return null;
}

async function fetchProductPrice(
  token: string,
  locationId: string,
  term: string,
): Promise<{ title: string; price: number; promo?: string; url?: string } | null> {
  const search = new URLSearchParams({
    'filter.term': term.slice(0, 48),
    'filter.locationId': locationId,
    'filter.limit': '8',
  });
  const response = await fetch(`${KROGER_API}/products?${search.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { data?: Record<string, unknown>[] };
  const products = json.data ?? [];
  if (products.length === 0) return null;

  let best: { title: string; price: number; promo?: string; url?: string } | null = null;
  for (const product of products) {
    const items = (product.items as Record<string, unknown>[]) ?? [];
    for (const item of items) {
      const picked = pickPrice(item.price as Record<string, unknown> | undefined);
      if (!picked) continue;
      const title = String(product.description ?? term);
      const url = product.productId
        ? `https://www.kroger.com/p/${String(product.productId)}`
        : undefined;
      if (!best || picked.unit < best.price) {
        best = { title, price: picked.unit, promo: picked.promoLabel, url };
      }
    }
  }
  return best;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('KROGER_CLIENT_ID') ?? '';
    const clientSecret = Deno.env.get('KROGER_CLIENT_SECRET') ?? '';
    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          error: 'Kroger credentials not configured on server. Add KROGER_CLIENT_ID and KROGER_CLIENT_SECRET in Supabase secrets.',
          configured: false,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const body = (await req.json()) as {
      action: 'stores' | 'deals';
      lat?: number;
      lng?: number;
      zip?: string;
      radiusMiles?: number;
      stores?: StoreLocation[];
      items?: GroceryItemPayload[];
    };

    const token = await getKrogerToken(clientId, clientSecret);

    if (body.action === 'stores') {
      const stores = await fetchNearbyStores(token, body);
      return new Response(JSON.stringify({ stores, configured: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'deals') {
      const stores = body.stores ?? [];
      const items = body.items ?? [];
      const deals: Record<string, unknown>[] = [];

      for (const item of items) {
        for (const store of stores) {
          const match = await fetchProductPrice(token, store.id, item.name);
          if (!match) continue;
          const lineTotal = Math.round(match.price * item.quantity * 100) / 100;
          deals.push({
            groceryItemId: item.id,
            storeId: store.id,
            productTitle: match.title,
            unitPrice: match.price,
            lineTotal,
            quantity: item.quantity,
            unit: item.unit,
            promoLabel: match.promo,
            productUrl: match.url ?? store.url,
          });
        }
      }

      const storeTotals = stores.map((store) => {
        const storeDeals = deals.filter((d) => d.storeId === store.id);
        const subtotal = storeDeals.reduce((sum, d) => sum + Number(d.lineTotal), 0);
        const promoCount = storeDeals.filter((d) => d.promoLabel).length;
        return {
          storeId: store.id,
          subtotal: Math.round(subtotal * 100) / 100,
          itemCount: storeDeals.length,
          missingCount: Math.max(0, items.length - storeDeals.length),
          promoCount,
          pricesAvailable: true,
        };
      });

      const sorted = [...storeTotals].sort((a, b) => b.itemCount - a.itemCount || a.subtotal - b.subtotal);
      const best = sorted[0];
      const bestStore = stores.find((s) => s.id === best?.storeId);

      const result = {
        stores,
        deals,
        storeTotals,
        suggestion: {
          kind: 'single_store',
          label: bestStore ? `Kroger: ${bestStore.chain}` : 'Kroger locations',
          storeIds: best ? [best.storeId] : [],
          estimatedTotal: best?.subtotal ?? 0,
          note: 'Live Kroger product search at selected locations (weekly promos when available).',
        },
      };

      return new Response(JSON.stringify({ result, configured: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kroger proxy error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
