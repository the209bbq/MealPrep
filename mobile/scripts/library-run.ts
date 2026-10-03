/**
 * Batch runner for library-generate Edge Function.
 *
 * Usage (from mobile/):
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   LIBRARY_ADMIN_SECRET=your-secret \
 *   npx tsx scripts/library-run.ts --batches 5 --batch-size 2
 *
 * Optional: SUPABASE_ACCESS_TOKEN for Management API deploy is not required here.
 */

const DEFAULT_BATCHES = 3;
const DEFAULT_BATCH_SIZE = 2;
const DELAY_MS = 4_000;

function parseArgs(): { batches: number; batchSize: number } {
  const args = process.argv.slice(2);
  let batches = DEFAULT_BATCHES;
  let batchSize = DEFAULT_BATCH_SIZE;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--batches' && args[i + 1]) {
      batches = Math.max(1, Number.parseInt(args[i + 1], 10) || DEFAULT_BATCHES);
      i += 1;
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      batchSize = Math.max(1, Number.parseInt(args[i + 1], 10) || DEFAULT_BATCH_SIZE);
      i += 1;
    }
  }
  return { batches, batchSize };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const secret = (process.env.LIBRARY_ADMIN_SECRET ?? '').trim();
  if (!supabaseUrl || !secret) {
    console.error('Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and LIBRARY_ADMIN_SECRET');
    process.exit(1);
  }

  const { batches, batchSize } = parseArgs();
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/library-generate`;

  for (let batch = 0; batch < batches; batch += 1) {
    console.log(`library-run: batch ${batch + 1}/${batches} (size ${batchSize})`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-library-admin-secret': secret,
      },
      body: JSON.stringify({ batchSize }),
    });
    const text = await response.text();
    let json: { stopForDay?: boolean; processed?: number; results?: unknown[]; error?: string } = {};
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      console.error('Non-JSON response', response.status, text.slice(0, 400));
      process.exit(1);
    }

    if (!response.ok) {
      console.error('library-generate failed', response.status, json.error ?? text);
      process.exit(1);
    }

    console.log(JSON.stringify(json, null, 2));
    if (json.stopForDay) {
      console.log('library-run: quota exhausted — stop for the day');
      break;
    }
    if (batch < batches - 1) {
      await sleep(DELAY_MS);
    }
  }
}

void main();
