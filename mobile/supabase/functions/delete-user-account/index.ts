// Delete the signed-in user's account and kitchen data — paste into Supabase Dashboard:
// Edge Functions → delete-user-account → Via Editor
//
// Settings: leave "Verify JWT" ENABLED.
//
// Requires SQL migration: 20261002150000_account_deletion_fks_and_rpc.sql
// (and 20261002143000_avatars_storage.sql for avatars bucket).
//
// Secrets: SUPABASE_SERVICE_ROLE_KEY (default), SUPABASE_URL, SUPABASE_ANON_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USER_STORAGE_BUCKETS = ['avatars', 'scan-photos'] as const;

type StorageListEntry = { name: string; id: string | null };

function isSafeUserStoragePath(objectPath: string, userId: string): boolean {
  const normalized = objectPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) return false;
  const prefix = `${userId}/`;
  return normalized === userId || normalized.startsWith(prefix);
}

function collectPathsFromListPage(
  userId: string,
  folderPrefix: string,
  entries: StorageListEntry[],
): { filePaths: string[]; childFolderPrefixes: string[] } {
  const filePaths: string[] = [];
  const childFolderPrefixes: string[] = [];
  const base = folderPrefix.replace(/\/$/, '') || userId;
  if (!isSafeUserStoragePath(base, userId)) return { filePaths, childFolderPrefixes };

  for (const entry of entries) {
    if (!entry.name) continue;
    const fullPath = `${base}/${entry.name}`;
    if (!isSafeUserStoragePath(fullPath, userId)) continue;
    if (entry.id === null) childFolderPrefixes.push(fullPath);
    else filePaths.push(fullPath);
  }
  return { filePaths, childFolderPrefixes };
}

/** @sync mobile/lib/account/deleteUserServerLogic.ts */
async function listAllObjectPathsUnderUserPrefix(
  admin: ReturnType<typeof createClient>,
  bucketId: string,
  userId: string,
): Promise<string[]> {
  const files: string[] = [];
  const queue = [userId];

  while (queue.length > 0) {
    const folder = queue.shift()!;
    if (!isSafeUserStoragePath(folder, userId)) continue;

    const { data, error } = await admin.storage.from(bucketId).list(folder, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error || !data?.length) continue;

    const { filePaths, childFolderPrefixes } = collectPathsFromListPage(
      userId,
      folder,
      data as StorageListEntry[],
    );
    files.push(...filePaths);
    queue.push(...childFolderPrefixes);
  }

  return [...new Set(files.filter((path) => isSafeUserStoragePath(path, userId)))];
}

async function deleteUserStorage(admin: ReturnType<typeof createClient>, userId: string): Promise<void> {
  for (const bucketId of USER_STORAGE_BUCKETS) {
    const paths = await listAllObjectPathsUnderUserPrefix(admin, bucketId, userId);
    if (paths.length === 0) continue;
    const chunkSize = 100;
    for (let i = 0; i < paths.length; i += chunkSize) {
      const chunk = paths.slice(i, i + chunkSize);
      const { error } = await admin.storage.from(bucketId).remove(chunk);
      if (error) {
        console.warn('[delete-user-account] storage remove failed', bucketId, error.message);
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = userData.user.id;
  const admin = createClient(supabaseUrl, serviceKey);

  const { error: rpcError } = await admin.rpc('delete_user_owned_data', { p_user_id: userId });
  if (rpcError) {
    return new Response(JSON.stringify({ error: rpcError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await deleteUserStorage(admin, userId);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
