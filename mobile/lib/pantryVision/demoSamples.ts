import type { PantryVisionDetection } from './types';

/** Clearly labeled sample detections for demo / offline mode. */
export function getDemoPantryDetections(): PantryVisionDetection[] {
  return [
    {
      name: '[Demo sample] Jasmine rice',
      quantity: 2,
      unit: 'lb',
      category: 'dry_goods',
      confidence: 0.92,
    },
    {
      name: '[Demo sample] Smoked paprika',
      quantity: 1,
      unit: 'jar',
      category: 'spices',
      confidence: 0.88,
    },
    {
      name: '[Demo sample] Broccoli florets',
      quantity: 1,
      unit: 'bag',
      category: 'produce',
      confidence: 0.81,
    },
  ];
}
