import { Pressable, ScrollView, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { CATEGORY_LABELS } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';

export default function GroceryScreen() {
  const { grocery, toggleGroceryItem, selectedRecipeIds, featureFlags, refreshGrocery } = useApp();
  const open = grocery.filter((g) => !g.checked);
  const done = grocery.filter((g) => g.checked);

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8">
      <Card className="mt-4" title="Grocery list" subtitle="Recipes minus pantry stock">
        <Text className="mt-2 text-sm text-muted">
          {selectedRecipeIds.length} recipe(s) in your meal plan.
          {featureFlags.grocerySync ? ' List updates when pantry or recipes change.' : ' Grocery sync is off.'}
        </Text>
        <Pressable onPress={refreshGrocery} className="mt-3 self-start rounded-full bg-emerald px-4 py-2">
          <Text className="text-xs font-bold text-on-emerald">Refresh list</Text>
        </Pressable>
      </Card>

      <Text className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-muted">To buy ({open.length})</Text>
      {open.length === 0 ? (
        <Text className="text-sm text-muted">Nothing to buy — pantry covers your selected recipes.</Text>
      ) : (
        open.map((item) => (
          <Pressable key={item.id} onPress={() => toggleGroceryItem(item.id)}>
            <Card className="mb-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="font-bold text-ink">{item.name}</Text>
                  <Text className="text-sm text-muted">
                    {item.quantity} {item.unit} · {CATEGORY_LABELS[item.category]}
                  </Text>
                </View>
                <View className="h-6 w-6 rounded border-2 border-emerald" />
              </View>
            </Card>
          </Pressable>
        ))
      )}

      {done.length > 0 ? (
        <>
          <Text className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-muted">Checked ({done.length})</Text>
          {done.map((item) => (
            <Pressable key={item.id} onPress={() => toggleGroceryItem(item.id)}>
              <Card className="mb-2 opacity-70">
                <Text className="font-semibold text-muted line-through">{item.name}</Text>
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
