import { Pressable, ScrollView, Text } from 'react-native';
import { CATEGORY_LABELS } from '../config/appConfig';
import type { PantryCategory } from '../types/mealprep';
import { PANTRY_CATEGORIES } from '../types/mealprep';

interface CategoryChipsProps {
  selected: PantryCategory | 'all';
  onSelect: (category: PantryCategory | 'all') => void;
}

export function CategoryChips({ selected, onSelect }: CategoryChipsProps) {
  const items: Array<{ key: PantryCategory | 'all'; label: string }> = [
    { key: 'all', label: 'All' },
    ...PANTRY_CATEGORIES.map((c) => ({ key: c, label: CATEGORY_LABELS[c] })),
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
      {items.map((item) => {
        const active = selected === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            className={`mr-2 rounded-full px-3 py-1.5 ${active ? 'bg-emerald' : 'border border-border bg-paper'}`}
          >
            <Text className={`text-xs font-semibold ${active ? 'text-on-emerald' : 'text-muted'}`}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
