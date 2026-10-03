import { useMemo } from 'react';
import { RecipeImportBox } from '../../components/recipes/RecipeImportBox';

export function RecipeImportFromLink({ initialUrl = '' }: { initialUrl?: string }) {
  return <RecipeImportBox initialText={initialUrl} />;
}

/** Prefilled import from Android share target or deep link. */
export function RecipeImportFromShareParams({
  url,
  text,
  autoRun,
}: {
  url?: string;
  text?: string;
  autoRun?: boolean;
}) {
  const initialText = useMemo(() => {
    const direct = url?.trim() ?? '';
    if (direct) return direct;
    return text?.trim() ?? '';
  }, [text, url]);

  return <RecipeImportBox key={initialText || 'default'} initialText={initialText} autoRun={autoRun} />;
}
