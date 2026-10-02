import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SCAN_CORRECTIONS } from '../../config/scanCorrections';
import { fetchAdminScanCorrectionsSummary } from '../../lib/supabaseData';
import { getSupabase } from '../../lib/supabase';
import type { AdminScanCorrectionsSummary } from '../../lib/scanCorrections/types';
import { Card } from '../Card';

export function AdminScanCorrectionsCard() {
  const [summary, setSummary] = useState<AdminScanCorrectionsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    void fetchAdminScanCorrectionsSummary(client, SCAN_CORRECTIONS.defaultSummaryDays)
      .then((data) => setSummary(data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load scan feedback');
      });
  }, []);

  const counts = summary?.counts ?? {};
  const renameCount = counts.rename ?? 0;
  const removedCount = counts.removed ?? 0;
  const addedCount = counts.added ?? 0;

  return (
    <Card
      className="mt-4"
      title="Pantry scan feedback"
      subtitle={`Last ${summary?.days ?? SCAN_CORRECTIONS.defaultSummaryDays} days (text only)`}
    >
      {error ? <Text className="mt-2 text-xs text-danger">{error}</Text> : null}
      {!summary && !error ? <Text className="mt-2 text-xs text-muted">Loading…</Text> : null}
      {summary ? (
        <View className="mt-2">
          <Text className="text-xs text-muted">
            Renamed {renameCount} · Removed {removedCount} · Added {addedCount}
          </Text>
          {summary.training_photo_scans > 0 ? (
            <Text className="mt-1 text-xs text-muted">
              Opt-in training photos: {summary.training_photo_scans} scan
              {summary.training_photo_scans === 1 ? '' : 's'}
            </Text>
          ) : null}
          {summary.top_renames.length > 0 ? (
            <View className="mt-2">
              <Text className="text-[10px] font-bold uppercase tracking-wide text-muted">Top renames</Text>
              {summary.top_renames.slice(0, 6).map((row) => (
                <Text key={`${row.ai_name}-${row.user_name}`} className="mt-1 text-xs text-ink" numberOfLines={1}>
                  {row.ai_name} → {row.user_name} ({row.count})
                </Text>
              ))}
            </View>
          ) : (
            <Text className="mt-2 text-xs text-muted">No rename patterns yet.</Text>
          )}
        </View>
      ) : null}
    </Card>
  );
}
