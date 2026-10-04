import { Stack, router, useLocalSearchParams } from 'expo-router';
import { VideoRecipeDetailView } from '../../components/recipes/VideoRecipeDetailView';
import {
  MOCK_VIDEO_ITEM,
  MOCK_VIDEO_MATCH,
  MOCK_VIDEO_RECIPE,
} from '../../lib/preview/videoRecipeDetailMock';

type PreviewState = 'loaded' | 'steps' | 'loading' | 'error';

function parseState(raw: string | string[] | undefined): PreviewState {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'steps' || value === 'loading' || value === 'error' || value === 'loaded') return value;
  return 'loaded';
}

export default function VideoRecipeDetailPreviewScreen() {
  const { state: stateParam } = useLocalSearchParams<{ state?: string }>();
  const state = parseState(stateParam);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <VideoRecipeDetailView
        recipe={MOCK_VIDEO_RECIPE}
        match={state === 'loading' ? { ...MOCK_VIDEO_MATCH, missingCount: 0 } : MOCK_VIDEO_MATCH}
        viralItem={MOCK_VIDEO_ITEM}
        creatorAvatarUrl={null}
        previewLoading={state === 'loading'}
        importing={false}
        importError={state === 'error' ? 'Network error (preview)' : null}
        initialSection={state === 'steps' ? 'steps' : 'ingredients'}
        onClose={() => router.back()}
        onAddMissing={() => undefined}
        recipeSaved={false}
        onToggleSaveRecipe={() => undefined}
        onRetryImport={() => undefined}
      />
    </>
  );
}
