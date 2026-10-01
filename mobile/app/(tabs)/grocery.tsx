import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { GroceryEmptyState } from '../../components/grocery/GroceryEmptyState';
import { GuestSaveNudge } from '../../components/GuestSaveNudge';
import { GroceryItemRow } from '../../components/grocery/GroceryItemRow';
import { CATEGORY_LABELS, THEME } from '../../config/appConfig';
import { APP_ROUTES } from '../../config/appRoutes';
import { GROCERY_COPY } from '../../config/grocery';
import { useApp } from '../../context/AppContext';
import { groupGroceryByAisle } from '../../lib/grocery';
import { inferGroceryCategoryFromName } from '../../lib/grocery/categorize';
import { useGroceryCommunityDealBadges } from '../../lib/communityDeals/useCommunityDeals';
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
    removeGroceryItem,
    onboarding,
  } = useApp();

  useFocusEffect(
    useCallback(() => {
      onboarding.notifyTutorialStepComplete('grocery');
    }, [onboarding]),
  );

  const insets = useSafeAreaInsets();
  const [cartExpanded, setCartExpanded] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualUnit, setManualUnit] = useState('each');
  const [manualCategory, setManualCategory] = useState<PantryCategory>(() => inferGroceryCategoryFromName(''));
  const [aisleTouched, setAisleTouched] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [addError, setAddError] = useState<{ title: string; message: string } | null>(null);

  const open = useMemo(() => grocery.filter((g) => !g.checked), [grocery]);
  const done = useMemo(() => grocery.filter((g) => g.checked), [grocery]);
  const totalCount = grocery.length;
  const checkedCount = done.length;
  const openSections = useMemo(() => groupGroceryByAisle(open), [open]);
  const openItemIds = useMemo(() => open.map((g) => g.id), [open]);
  const { badges: communityBadges } = useGroceryCommunityDealBadges(openItemIds, grocery);

  const recipeNameById = useMemo(() => new Map(recipes.map((r) => [r.id, r.name])), [recipes]);

  function recipeLabelFor(item: (typeof grocery)[number]): string {
    if (item.sourceRecipeIds.length === 0) return '';
    return item.sourceRecipeIds
      .map((id) => recipeNameById.get(id) ?? id)
      .join(', ');
  }

  function handleClearChecked() {
    if (done.length === 0) return;
    setClearConfirmOpen(true);
  }

  function confirmClearChecked() {
    setClearConfirmOpen(false);
    clearCheckedGroceryItems();
  }

  function requestRemoveItem(id: string, name: string) {
    setRemoveTarget({ id, name });
  }

  function confirmRemoveItem() {
    if (!removeTarget) return;
    removeGroceryItem(removeTarget.id);
    setRemoveTarget(null);
  }

  function submitManualItem() {
    const qty = Number.parseFloat(manualQty);
    if (!manualName.trim()) {
      setAddError({ title: GROCERY_COPY.nameRequiredTitle, message: GROCERY_COPY.nameRequiredMessage });
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setAddError({ title: GROCERY_COPY.quantityTitle, message: GROCERY_COPY.quantityMessage });
      return;
    }
    const inferred = inferGroceryCategoryFromName(manualName);
    addManualGroceryItem({
      name: manualName,
      quantity: qty,
      unit: manualUnit.trim() || 'each',
      category: aisleTouched ? manualCategory : inferred,
    });
    setManualName('');
    setManualQty('1');
    setManualUnit('each');
    setAisleTouched(false);
    setManualCategory(inferGroceryCategoryFromName(''));
    setAddOpen(false);
  }

  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const showShopCta = featureFlags.smartShop && open.length > 0;

  return (
    <>
      <View className="flex-1 bg-paper">
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: showShopCta ? 100 + insets.bottom : 32 }}>
          <View className="mt-4 overflow-hidden rounded-3xl bg-slate px-5 py-5">
            <Text className="text-xs font-bold uppercase tracking-widest text-on-primary-muted">{GROCERY_COPY.listTitle}</Text>
            <Text className="mt-1 text-2xl font-bold text-on-primary">
              {GROCERY_COPY.toBuyInCartLine(open.length, checkedCount)}
            </Text>
            <View className="mt-3 h-2 overflow-hidden rounded-full bg-on-primary-muted/30">
              <View className="h-full rounded-full bg-primary-accent" style={{ width: `${progressPct}%` }} />
            </View>
            <Text className="mt-2 text-sm text-on-primary-muted">
              {GROCERY_COPY.plannedMealsLine(plannedRecipeIds.length)}
            </Text>
            <View className="mt-4 flex-row flex-wrap gap-2">
              <Pressable
                onPress={() => {
                  setAisleTouched(false);
                  setManualCategory(inferGroceryCategoryFromName(manualName));
                  setAddOpen(true);
                }}
                className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <Ionicons name="add-circle-outline" size={20} color={THEME.primary} />
                <Text className="text-sm font-bold text-ink">{GROCERY_COPY.addItem}</Text>
              </Pressable>
              <Pressable
                onPress={refreshGrocery}
                className="min-h-[48px] rounded-2xl border border-on-primary-muted/40 bg-primary/30 px-4 py-3"
              >
                <Text className="text-center text-sm font-bold text-on-primary">{GROCERY_COPY.refresh}</Text>
              </Pressable>
            </View>
          </View>

          <GuestSaveNudge className="mt-3" />

          {totalCount === 0 ? (
            <View className="mt-6">
              <GroceryEmptyState />
            </View>
          ) : (
            <>
              <Text className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-muted">
                {GROCERY_COPY.toBuySection} ({open.length})
              </Text>
              {open.length === 0 ? (
                <View className="rounded-2xl border border-border bg-card px-4 py-5">
                  <Text className="text-center text-sm text-muted">{GROCERY_COPY.allSetHint}</Text>
                </View>
              ) : (
                openSections.map((section) => (
                  <View key={section.category} className="mb-4">
                    <View className="mb-2 flex-row items-center gap-2">
                      <View className="h-8 w-1 rounded-full bg-primary" />
                      <Text className="text-base font-bold text-ink">{section.label}</Text>
                      <Text className="text-sm text-muted">({section.items.length})</Text>
                    </View>
                    {section.items.map((item) => (
                      <GroceryItemRow
                        key={item.id}
                        item={item}
                        recipeLabels={recipeLabelFor(item)}
                        onToggle={() => toggleGroceryItem(item.id)}
                        onRemove={() => requestRemoveItem(item.id, item.name)}
                        communityDeal={communityBadges.get(item.id)}
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
                      <Ionicons name="bag-check-outline" size={22} color={THEME.primary} />
                      <Text className="text-base font-bold text-ink">{GROCERY_COPY.inCartSection} ({done.length})</Text>
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
                          onRemove={() => requestRemoveItem(item.id, item.name)}
                          dimmed
                        />
                      ))
                    : null}
                  <Pressable
                    onPress={handleClearChecked}
                    className="mt-2 min-h-[48px] items-center justify-center rounded-2xl border border-danger/30 bg-card py-3"
                  >
                    <Text className="text-sm font-bold text-danger">{GROCERY_COPY.clearCheckedItems}</Text>
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
              onPress={() => router.push(APP_ROUTES.smartShop)}
              className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3"
            >
              <Ionicons name="pricetags" size={22} color={THEME.onPrimary} />
              <Text className="text-base font-bold text-on-primary">{GROCERY_COPY.shopThisList(open.length)}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <ConfirmDialog
        visible={clearConfirmOpen}
        title={GROCERY_COPY.clearCheckedTitle}
        message={GROCERY_COPY.clearCheckedMessage(done.length)}
        confirmLabel={GROCERY_COPY.clear}
        cancelLabel={GROCERY_COPY.cancel}
        destructive
        onConfirm={confirmClearChecked}
        onCancel={() => setClearConfirmOpen(false)}
      />

      <ConfirmDialog
        visible={addError != null}
        title={addError?.title ?? ''}
        message={addError?.message ?? ''}
        confirmLabel="OK"
        cancelLabel={GROCERY_COPY.cancel}
        onConfirm={() => setAddError(null)}
        onCancel={() => setAddError(null)}
      />

      <ConfirmDialog
        visible={removeTarget != null}
        title={GROCERY_COPY.removeItemTitle}
        message={removeTarget ? GROCERY_COPY.removeItemMessage(removeTarget.name) : ''}
        confirmLabel={GROCERY_COPY.removeItem}
        cancelLabel={GROCERY_COPY.cancel}
        destructive
        onConfirm={confirmRemoveItem}
        onCancel={() => setRemoveTarget(null)}
      />

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl border border-border bg-paper px-4 pb-8 pt-4">
            <Text className="text-lg font-bold text-ink">{GROCERY_COPY.addItemModalTitle}</Text>
            <TextInput
              value={manualName}
              onChangeText={(text) => {
                setManualName(text);
                if (!aisleTouched) {
                  setManualCategory(inferGroceryCategoryFromName(text));
                }
              }}
              placeholder={GROCERY_COPY.itemNamePlaceholder}
              placeholderTextColor={THEME.muted}
              className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
            />
            <View className="mt-3 flex-row gap-2">
              <TextInput
                value={manualQty}
                onChangeText={setManualQty}
                keyboardType="decimal-pad"
                placeholder={GROCERY_COPY.qtyPlaceholder}
                placeholderTextColor={THEME.muted}
                className="w-24 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
              />
              <TextInput
                value={manualUnit}
                onChangeText={setManualUnit}
                placeholder={GROCERY_COPY.unitPlaceholder}
                placeholderTextColor={THEME.muted}
                className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
              />
            </View>
            <Text className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">{GROCERY_COPY.aisleLabel}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
              {PANTRY_CATEGORIES.map((cat) => {
                const selected = manualCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      setAisleTouched(true);
                      setManualCategory(cat);
                    }}
                    className={`mr-2 rounded-full px-3 py-2 ${selected ? 'bg-primary' : 'border border-border bg-card'}`}
                  >
                    <Text className={`text-xs font-semibold ${selected ? 'text-on-primary' : 'text-slate'}`}>
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View className="mt-6 flex-row gap-2">
              <Pressable onPress={() => setAddOpen(false)} className="flex-1 rounded-2xl border border-border py-3">
                <Text className="text-center font-bold text-slate">{GROCERY_COPY.cancel}</Text>
              </Pressable>
              <Pressable onPress={submitManualItem} className="flex-1 rounded-2xl bg-primary py-3">
                <Text className="text-center font-bold text-on-primary">{GROCERY_COPY.addToList}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
