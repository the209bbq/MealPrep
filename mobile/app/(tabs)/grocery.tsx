import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GroceryEmptyState } from '../../components/grocery/GroceryEmptyState';
import { GroceryItemRow } from '../../components/grocery/GroceryItemRow';
import { CATEGORY_LABELS, THEME } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';
import { groupGroceryByAisle } from '../../lib/grocery';
import { PANTRY_CATEGORIES, type PantryCategory } from '../../types/mealprep';

export default function GroceryScreen() {
  const {
    grocery,
    recipes,
    toggleGroceryItem,
    plannedRecipeIds,
    featureFlags,
    refreshGrocery,
    addManualGroceryItem,
    clearCheckedGroceryItems,
  } = useApp();

  const insets = useSafeAreaInsets();
  const [cartExpanded, setCartExpanded] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualUnit, setManualUnit] = useState('each');
  const [manualCategory, setManualCategory] = useState<PantryCategory>('produce');

  const open = useMemo(() => grocery.filter((g) => !g.checked), [grocery]);
  const done = useMemo(() => grocery.filter((g) => g.checked), [grocery]);
  const totalCount = grocery.length;
  const checkedCount = done.length;
  const openSections = useMemo(() => groupGroceryByAisle(open), [open]);

  const recipeNameById = useMemo(() => new Map(recipes.map((r) => [r.id, r.name])), [recipes]);

  function recipeLabelFor(item: (typeof grocery)[number]): string {
    if (item.sourceRecipeIds.length === 0) return '';
    return item.sourceRecipeIds
      .map((id) => recipeNameById.get(id) ?? id)
      .join(', ');
  }

  function handleClearChecked() {
    if (done.length === 0) return;
    Alert.alert('Clear checked items', `Remove ${done.length} item(s) from your list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearCheckedGroceryItems },
    ]);
  }

  function submitManualItem() {
    const qty = Number.parseFloat(manualQty);
    if (!manualName.trim()) {
      Alert.alert('Name required', 'Enter an item name.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Quantity', 'Enter a valid quantity.');
      return;
    }
    addManualGroceryItem({
      name: manualName,
      quantity: qty,
      unit: manualUnit.trim() || 'each',
      category: manualCategory,
    });
    setManualName('');
    setManualQty('1');
    setManualUnit('each');
    setAddOpen(false);
  }

  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const showShopCta = featureFlags.smartShop && open.length > 0;

  return (
    <>
      <View className="flex-1 bg-paper">
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: showShopCta ? 100 + insets.bottom : 32 }}>
          <View className="mt-4 overflow-hidden rounded-3xl bg-slate px-5 py-5">
            <Text className="text-xs font-bold uppercase tracking-widest text-emerald-light">Grocery list</Text>
            <Text className="mt-1 text-2xl font-bold text-on-emerald">
              {open.length} to buy · {checkedCount} in cart
            </Text>
            <View className="mt-3 h-2 overflow-hidden rounded-full bg-slate-muted/40">
              <View className="h-full rounded-full bg-emerald-accent" style={{ width: `${progressPct}%` }} />
            </View>
            <Text className="mt-2 text-sm text-emerald-light">
              {plannedRecipeIds.length} planned meal(s) · only buy what recipes still need
            </Text>
            <View className="mt-4 flex-row flex-wrap gap-2">
              <Pressable
                onPress={() => setAddOpen(true)}
                className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <Ionicons name="add-circle-outline" size={20} color={THEME.emerald} />
                <Text className="text-sm font-bold text-ink">Add item</Text>
              </Pressable>
              <Pressable
                onPress={refreshGrocery}
                className="min-h-[48px] rounded-2xl border border-emerald-light bg-emerald-light px-4 py-3"
              >
                <Text className="text-center text-sm font-bold text-emerald-dark">Refresh</Text>
              </Pressable>
            </View>
          </View>

          {totalCount === 0 ? (
            <View className="mt-6">
              <GroceryEmptyState />
            </View>
          ) : (
            <>
              <Text className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-muted">To buy ({open.length})</Text>
              {open.length === 0 ? (
                <View className="rounded-2xl border border-border bg-card px-4 py-5">
                  <Text className="text-center text-sm text-muted">All set — clear checked items or plan another meal.</Text>
                </View>
              ) : (
                openSections.map((section) => (
                  <View key={section.category} className="mb-4">
                    <View className="mb-2 flex-row items-center gap-2">
                      <View className="h-8 w-1 rounded-full bg-emerald" />
                      <Text className="text-base font-bold text-ink">{section.label}</Text>
                      <Text className="text-sm text-muted">({section.items.length})</Text>
                    </View>
                    {section.items.map((item) => (
                      <GroceryItemRow
                        key={item.id}
                        item={item}
                        recipeLabels={recipeLabelFor(item)}
                        onToggle={() => toggleGroceryItem(item.id)}
                      />
                    ))}
                  </View>
                ))
              )}

              {done.length > 0 ? (
                <View className="mt-2">
                  <Pressable
                    onPress={() => setCartExpanded((v) => !v)}
                    className="mb-2 flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="bag-check-outline" size={22} color={THEME.emerald} />
                      <Text className="text-base font-bold text-ink">In cart ({done.length})</Text>
                    </View>
                    <Ionicons name={cartExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={THEME.muted} />
                  </Pressable>
                  {cartExpanded
                    ? done.map((item) => (
                        <GroceryItemRow
                          key={item.id}
                          item={item}
                          recipeLabels={recipeLabelFor(item)}
                          onToggle={() => toggleGroceryItem(item.id)}
                          dimmed
                        />
                      ))
                    : null}
                  <Pressable
                    onPress={handleClearChecked}
                    className="mt-2 min-h-[48px] items-center justify-center rounded-2xl border border-danger/30 bg-card py-3"
                  >
                    <Text className="text-sm font-bold text-danger">Clear checked items</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {showShopCta ? (
          <View
            className="absolute bottom-0 left-0 right-0 border-t border-border bg-card px-4 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <Pressable
              onPress={() => router.push('/smart-shop')}
              className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-emerald px-4 py-3"
            >
              <Ionicons name="pricetags" size={22} color={THEME.onEmerald} />
              <Text className="text-base font-bold text-on-emerald">Shop this list ({open.length})</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl border border-border bg-paper px-4 pb-8 pt-4">
            <Text className="text-lg font-bold text-ink">Add item</Text>
            <TextInput
              value={manualName}
              onChangeText={setManualName}
              placeholder="Item name"
              placeholderTextColor={THEME.muted}
              className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
            />
            <View className="mt-3 flex-row gap-2">
              <TextInput
                value={manualQty}
                onChangeText={setManualQty}
                keyboardType="decimal-pad"
                placeholder="Qty"
                placeholderTextColor={THEME.muted}
                className="w-24 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
              />
              <TextInput
                value={manualUnit}
                onChangeText={setManualUnit}
                placeholder="Unit"
                placeholderTextColor={THEME.muted}
                className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
              />
            </View>
            <Text className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Aisle</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
              {PANTRY_CATEGORIES.map((cat) => {
                const selected = manualCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setManualCategory(cat)}
                    className={`mr-2 rounded-full px-3 py-2 ${selected ? 'bg-emerald' : 'border border-border bg-card'}`}
                  >
                    <Text className={`text-xs font-semibold ${selected ? 'text-on-emerald' : 'text-slate'}`}>
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View className="mt-6 flex-row gap-2">
              <Pressable onPress={() => setAddOpen(false)} className="flex-1 rounded-2xl border border-border py-3">
                <Text className="text-center font-bold text-slate">Cancel</Text>
              </Pressable>
              <Pressable onPress={submitManualItem} className="flex-1 rounded-2xl bg-emerald py-3">
                <Text className="text-center font-bold text-on-emerald">Add to list</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
