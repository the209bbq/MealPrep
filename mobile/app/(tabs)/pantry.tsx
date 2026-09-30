import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { CategoryChips } from '../../components/CategoryChips';
import { CATEGORY_LABELS } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';
import type { PantryCategory } from '../../types/mealprep';

export default function PantryScreen() {
  const { pantry, addPantryFromScan, featureFlags } = useApp();
  const [filter, setFilter] = useState<PantryCategory | 'all'>('all');
  const [lastScanUri, setLastScanUri] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === 'all' ? pantry : pantry.filter((item) => item.category === filter)),
    [filter, pantry],
  );

  async function handleScan() {
    if (!featureFlags.photoScan) {
      Alert.alert('Feature off', 'Photo scan is disabled in feature toggles.');
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera', 'Camera permission is required for pantry scanning.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    setLastScanUri(uri);
    // TODO: Send image to a recognition service (no API keys in repo). For now, stub with a placeholder name.
    addPantryFromScan('Unrecognized item (stub)', uri);
    Alert.alert(
      'Scan saved',
      'Photo captured. Ingredient recognition is not wired yet — edit the pantry item after labeling.',
    );
  }

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    setLastScanUri(uri);
    addPantryFromScan('Gallery item (stub)', uri);
  }

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8">
      <Card className="mt-4" title="Pantry inventory" subtitle="Filter by category or scan new items">
        <View className="mt-3 flex-row gap-2">
          <Pressable onPress={() => void handleScan()} className="flex-1 rounded-xl bg-emerald px-3 py-3">
            <Text className="text-center text-sm font-bold text-on-emerald">Scan shelf</Text>
          </Pressable>
          <Pressable onPress={() => void handlePickImage()} className="flex-1 rounded-xl border border-border bg-card px-3 py-3">
            <Text className="text-center text-sm font-bold text-slate">Pick photo</Text>
          </Pressable>
        </View>
        {lastScanUri ? (
          <Image source={{ uri: lastScanUri }} className="mt-3 h-32 w-full rounded-xl" resizeMode="cover" />
        ) : null}
        <Text className="mt-2 text-xs text-muted">
          TODO: Connect vision API for automatic ingredient detection. No API keys are committed in this repo.
        </Text>
      </Card>

      <CategoryChips selected={filter} onSelect={setFilter} />

      {filtered.map((item) => (
        <Card key={item.id} className="mb-3">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-2">
              <Text className="text-base font-bold text-ink">{item.name}</Text>
              <Text className="text-sm text-muted">
                {CATEGORY_LABELS[item.category]} · {item.quantity} {item.unit}
              </Text>
              <Text className="text-xs text-muted">{item.location}</Text>
            </View>
            {item.photoUri ? (
              <Image source={{ uri: item.photoUri }} className="h-14 w-14 rounded-lg" />
            ) : null}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
