import React, { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { preparePantryImageFromFile } from '../lib/pantryVision/prepareImage.web';
import type { PreparedPantryImage } from '../lib/pantryVision/types';

interface PantryPhotoCaptureProps {
  onImagePrepared: (prepared: PreparedPantryImage) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

export function PantryPhotoCapture({ onImagePrepared, onError, disabled }: PantryPhotoCaptureProps) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const libraryRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void preparePantryImageFromFile(file)
      .then(onImagePrepared)
      .catch((error: unknown) => {
        onError(error instanceof Error ? error.message : 'Could not prepare photo');
      });
  };

  return (
    <View className="mt-3 flex-row gap-2">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      <Pressable
        disabled={disabled}
        onPress={() => cameraRef.current?.click()}
        className={`flex-1 rounded-xl px-3 py-3 ${disabled ? 'bg-slate/40' : 'bg-emerald'}`}
      >
        <Text className="text-center text-sm font-bold text-on-emerald">Scan shelf</Text>
      </Pressable>
      <Pressable
        disabled={disabled}
        onPress={() => libraryRef.current?.click()}
        className="flex-1 rounded-xl border border-border bg-card px-3 py-3"
      >
        <Text className="text-center text-sm font-bold text-slate">Pick photo</Text>
      </Pressable>
    </View>
  );
}
