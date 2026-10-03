import type { ViralRecipesCategory } from '../../config/viralRecipes';
import type { ViralRecipeLinkItem } from './types';

const DEMO_BASE: ViralRecipeLinkItem[] = [
  {
    videoId: 'demo-viral-1',
    category: 'viral',
    title: '15-minute viral garlic noodles',
    thumbnailUrl: 'https://i.ytimg.com/vi/demo/hqdefault.jpg',
    channelId: 'UCdemo1',
    channelTitle: 'Quick Kitchen',
    channelUrl: 'https://www.youtube.com/channel/UCdemo1',
    watchUrl: 'https://www.youtube.com/watch?v=demo-viral-1',
    viewCount: 1_200_000,
    publishedAt: null,
  },
  {
    videoId: 'demo-viral-2',
    category: 'viral',
    title: 'One-pan dinner everyone is making',
    thumbnailUrl: 'https://i.ytimg.com/vi/demo2/hqdefault.jpg',
    channelId: 'UCdemo2',
    channelTitle: 'Budget Bites',
    channelUrl: 'https://www.youtube.com/channel/UCdemo2',
    watchUrl: 'https://www.youtube.com/watch?v=demo-viral-2',
    viewCount: 890_000,
    publishedAt: null,
  },
];

export function demoViralRecipeItems(category: ViralRecipesCategory): ViralRecipeLinkItem[] {
  return DEMO_BASE.map((item) => ({ ...item, category }));
}
