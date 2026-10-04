import type { CreatorListItem, CreatorVideoItem } from './types';

export const demoCreators: CreatorListItem[] = [
  {
    id: 'demo-creator-1',
    youtubeChannelId: 'UCdemo0001',
    displayName: 'Weeknight Kitchen',
    handle: '@weeknightkitchen',
    channelUrl: 'https://www.youtube.com/@weeknightkitchen',
    avatarUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    subscriberCount: 1_200_000,
    rank: 1,
    fit: 'High',
    source: 'david_pick',
  },
  {
    id: 'demo-creator-2',
    youtubeChannelId: 'UCdemo0002',
    displayName: 'Pantry Chef',
    handle: '@pantrychef',
    channelUrl: 'https://www.youtube.com/@pantrychef',
    avatarUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    subscriberCount: 850_000,
    rank: 2,
    fit: 'Medium',
    source: 'david_pick',
  },
];

export function demoCreatorVideos(): CreatorVideoItem[] {
  return [
    {
      videoId: 'demoVid001',
      channelId: 'UCdemo0001',
      creatorName: 'Weeknight Kitchen',
      creatorHandle: '@weeknightkitchen',
      creatorAvatarUrl: demoCreators[0].avatarUrl,
      channelUrl: demoCreators[0].channelUrl,
      title: 'One-pan lemon chicken dinner',
      descriptionSnippet: 'Easy weeknight chicken recipe',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      publishedAt: '2026-03-01T12:00:00Z',
      viewCount: 420_000,
      likeCount: 18_000,
      durationSeconds: 720,
      isShort: false,
      watchUrl: 'https://www.youtube.com/watch?v=demoVid001',
    },
    {
      videoId: 'demoVid002',
      channelId: 'UCdemo0002',
      creatorName: 'Pantry Chef',
      creatorHandle: '@pantrychef',
      creatorAvatarUrl: demoCreators[1].avatarUrl,
      channelUrl: demoCreators[1].channelUrl,
      title: 'Budget bean chili',
      descriptionSnippet: 'Cheap pantry chili for meal prep',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      publishedAt: '2026-02-20T08:00:00Z',
      viewCount: 210_000,
      likeCount: 9_500,
      durationSeconds: 540,
      isShort: false,
      watchUrl: 'https://www.youtube.com/watch?v=demoVid002',
    },
  ];
}
