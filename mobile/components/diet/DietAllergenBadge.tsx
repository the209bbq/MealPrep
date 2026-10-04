import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { ALLERGEN_OPTIONS } from '../../config/diet';
import { useApp } from '../../context/AppContext';
import { recipeDietTagFromIngredientLines } from '../../lib/diet/conflicts';
import { primaryAllergenConflictBadge } from '../../lib/diet/summaryLine';

type DietAllergenBadgeProps = {
  ingredientLines: string[] | null;
};

export function DietAllergenBadge({ ingredientLines }: DietAllergenBadgeProps) {
  const { userDietPrefs } = useApp();
  const label = useMemo(() => {
    if (!ingredientLines?.length || userDietPrefs.allergens.length === 0) return null;
    const tag = recipeDietTagFromIngredientLines(ingredientLines, userDietPrefs);
    const allergen = primaryAllergenConflictBadge(userDietPrefs, tag);
    if (!allergen) return null;
    const option = ALLERGEN_OPTIONS.find((row) => row.id === allergen);
    return option?.label ?? allergen;
  }, [ingredientLines, userDietPrefs]);

  if (!label) return null;

  return (
    <View className="absolute left-2 top-2 rounded-full bg-danger px-2 py-0.5">
      <Text className="text-[10px] font-bold text-on-primary">{label}</Text>
    </View>
  );
}
