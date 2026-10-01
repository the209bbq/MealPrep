import type { GroceryListItem } from '../../types/mealprep';
import {
  computeLineTotal,
  packagesNeededForLine,
  parsePackageSizeFromText,
  type ProductPackageSize,
} from '../deals/packagePricing';
import type { CommunityStoreDeal } from './types';

function packageSizeFromDeal(deal: CommunityStoreDeal): ProductPackageSize | null {
  if (deal.unit?.trim()) {
    const fromUnit = parsePackageSizeFromText(deal.unit);
    if (fromUnit) return fromUnit;
    const amountMatch = /^(\d+(?:\.\d+)?)\s*(\S+)$/.exec(deal.unit.trim());
    if (amountMatch) {
      return { amount: Number.parseFloat(amountMatch[1] ?? ''), unit: amountMatch[2] ?? 'each' };
    }
  }
  return parsePackageSizeFromText(deal.itemName);
}

export function communityLineTotalForItem(deal: CommunityStoreDeal, item: GroceryListItem): number {
  const unitPrice = Math.round(deal.price * 100) / 100;
  const packageSize = packageSizeFromDeal(deal);
  const packages = packagesNeededForLine(item.quantity, item.unit, packageSize);
  return computeLineTotal(unitPrice, packages);
}
