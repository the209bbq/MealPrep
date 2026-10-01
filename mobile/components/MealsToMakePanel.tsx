import { Pressable, Text, View } from 'react-native';
import { Card } from './Card';
import type { MealPlanItem } from '../types/mealprep';
import { THEME } from '../config/appConfig';
import { Ionicons } from '@expo/vector-icons';

interface MealsToMakePanelProps {
  items: MealPlanItem[];
  compact?: boolean;
  onRemove: (id: string) => void;
  onMarkMade: (id: string) => void;
  onUndoMade: (id: string) => void;
  onAddMissingToGrocery?: () => void;
}

export function MealsToMakePanel({
  items,
  compact = false,
  onRemove,
  onMarkMade,
  onUndoMade,
  onAddMissingToGrocery,
}: MealsToMakePanelProps) {
  const active = items.filter((m) => !m.made);
  const done = items.filter((m) => m.made);

  if (items.length === 0) {
    return (
      <Card className={compact ? 'mt-3' : 'mt-4'} title="Meals to make" subtitle="Add recipes from search or your kitchen">
        <Text className="mt-2 text-sm text-muted">
          Plan what you will cook this week — one tap adds missing items to your grocery list so shopping is faster.
        </Text>
      </Card>
    );
  }

  return (
    <Card
      className={compact ? 'mt-3' : 'mt-4'}
      title={`Meals to make (${active.length})`}
      subtitle={compact ? 'Made it deducts pantry & moves to cooked' : 'Your cooking queue for the week'}
    >
      {active.map((item, index) => (
        <View
          key={item.id}
          className={`flex-row items-center justify-between py-2.5 ${index > 0 ? 'border-t border-border' : ''}`}
        >
          <Text className="mr-2 flex-1 font-semibold text-ink" numberOfLines={2}>{item.title}</Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => onMarkMade(item.id)}
              className="rounded-full bg-primary-light px-3 py-1.5"
            >
              <Text className="text-xs font-bold text-primary-dark">Made it</Text>
            </Pressable>
            <Pressable onPress={() => onRemove(item.id)} className="p-1">
              <Ionicons name="close-circle" size={22} color={THEME.muted} />
            </Pressable>
          </View>
        </View>
      ))}

      {done.length > 0 ? (
        <View className="mt-3 border-t border-border pt-2">
          <Text className="text-xs font-semibold uppercase text-muted">Cooked</Text>
          {done.map((item) => (
            <View key={item.id} className="mt-2 flex-row items-center justify-between">
              <Text className="flex-1 text-sm text-muted line-through" numberOfLines={1}>{item.title}</Text>
              <Pressable onPress={() => onUndoMade(item.id)}>
                <Text className="text-xs font-bold text-primary-dark">Undo</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {onAddMissingToGrocery && active.length > 0 ? (
        <Pressable onPress={onAddMissingToGrocery} className="mt-4 items-center rounded-xl border border-primary py-3">
          <Text className="text-sm font-bold text-primary-dark">Add missing ingredients to grocery list</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
