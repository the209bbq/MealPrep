import { View } from 'react-native';
import type { PreparedPantryImage } from '../lib/pantryVision/types';

/** Native uses expo-image-picker directly from the Pantry screen. */
export function PantryPhotoCapture(_props: {
  onImagePrepared: (prepared: PreparedPantryImage) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  return <View />;
}
