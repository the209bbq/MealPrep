import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { pickWebImageFile } from '../../lib/web/pickWebImageFile';
import { prepareAvatarImage } from '../../lib/avatars/prepareAvatarImage';
import type { PreparedAvatarImage } from '../../lib/avatars/types';

export async function pickProfilePhotoFromLibrary(): Promise<PreparedAvatarImage | null> {
  if (Platform.OS === 'web') {
    const file = await pickWebImageFile();
    if (!file) return null;
    const { prepareAvatarImageFromFile } = await import('../../lib/avatars/prepareAvatarImage.web');
    return prepareAvatarImageFromFile(file);
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]?.uri) return null;
  return prepareAvatarImage(result.assets[0].uri);
}
