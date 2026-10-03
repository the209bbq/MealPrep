import { View } from 'react-native';

/** Official YouTube iframe embed only (no custom thumbnails or downloaded media). */
export function RecipeYouTubeEmbed({ videoId }: { videoId: string }) {
  const id = encodeURIComponent(videoId);
  return (
    <View className="mt-3 w-full overflow-hidden rounded-xl bg-ink" style={{ aspectRatio: 16 / 9 }}>
      <iframe
        title="YouTube recipe video"
        src={`https://www.youtube.com/embed/${id}`}
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </View>
  );
}
