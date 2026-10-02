import { Ionicons } from '../../lib/icons/Ionicons';
import { Image, Text, View } from 'react-native';
import { THEME } from '../../config/appConfig';
import { initials } from '../../lib/initials';

type ProfileAvatarProps = {
  name: string;
  photoUrl: string | null;
  size?: number;
  guest?: boolean;
};

export function ProfileAvatar({ name, photoUrl, size = 32, guest = false }: ProfileAvatarProps) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (photoUrl?.trim()) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={dimension}
        accessibilityIgnoresInvertColors
        accessibilityLabel={guest ? 'Account' : `Profile photo for ${name}`}
      />
    );
  }

  if (guest) {
    return (
      <View
        style={dimension}
        className="items-center justify-center border border-on-primary-muted/40 bg-slate"
        accessibilityLabel="Guest account"
      >
        <Ionicons name="person-outline" size={size * 0.5} color={THEME.onPrimaryMuted} />
      </View>
    );
  }

  return (
    <View style={dimension} className="items-center justify-center bg-primary">
      <Text className="font-bold text-on-primary" style={{ fontSize: size * 0.34 }}>
        {initials(name)}
      </Text>
    </View>
  );
}
