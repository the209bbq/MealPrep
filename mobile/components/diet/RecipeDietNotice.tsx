import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { DIET_PREF_COPY } from '../../config/diet';
import { useApp } from '../../context/AppContext';
import { recipeDietTagFromIngredientLines } from '../../lib/diet/conflicts';
import { recipeDietSummaryForPrefs } from '../../lib/diet/summaryLine';

type RecipeDietNoticeProps = {
  ingredientLines: string[];
  className?: string;
};

export function RecipeDietNotice({ ingredientLines, className }: RecipeDietNoticeProps) {
  const { userDietPrefs } = useApp();
  const summary = useMemo(() => {
    if (ingredientLines.length === 0) return null;
    const hasPrefs =
      userDietPrefs.diets.length > 0 ||
      userDietPrefs.allergens.length > 0 ||
      userDietPrefs.dislikes.length > 0;
    if (!hasPrefs) return null;
    const tag = recipeDietTagFromIngredientLines(ingredientLines, userDietPrefs);
    return recipeDietSummaryForPrefs(userDietPrefs, tag, ingredientLines);
  }, [ingredientLines, userDietPrefs]);

  if (!summary) return null;

  return (
    <View className={className ?? 'mt-2'}>
      <Text className="text-sm text-danger">{summary}</Text>
      <Text className="mt-0.5 text-[11px] text-muted">{DIET_PREF_COPY.estimateDisclaimer}</Text>
    </View>
  );
}
