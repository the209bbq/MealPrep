/**
 * Shared merge/dedupe for pantry vision rows (client post-process + edge function).
 * Edge function inlines this block in index.ts — see pantry-vision-merge-inline-check.ts.
 */

export type PantryMergeRow = {
  name: string;
  quantity: number;
  unit: string;
  confidence: number;
};

export type PantryMergeIdentity = {
  identityKey: (name: string) => string;
  rowsMatch: (a: string, b: string) => boolean;
};

export function stableSortByName<T extends { name: string }>(
  items: T[],
  identityKey: (name: string) => string,
): T[] {
  return [...items].sort((a, b) => identityKey(a.name).localeCompare(identityKey(b.name)));
}

function pickBetterName(a: string, b: string): string {
  const lenA = a.trim().length;
  const lenB = b.trim().length;
  if (lenA !== lenB) return lenA > lenB ? a : b;
  return a.localeCompare(b) <= 0 ? a : b;
}

export function mergePantryRowPair<T extends PantryMergeRow>(existing: T, incoming: T): T {
  const sameUnit = existing.unit.toLowerCase() === incoming.unit.toLowerCase();
  const quantity = sameUnit
    ? Math.max(existing.quantity, incoming.quantity)
    : Math.max(existing.quantity, incoming.quantity);
  return {
    ...existing,
    name: pickBetterName(existing.name, incoming.name),
    quantity,
    unit: existing.unit || incoming.unit,
    confidence: Math.max(existing.confidence, incoming.confidence),
  };
}

/** Collapse duplicate products; never sum quantities across passes (avoids doubled counts). */
export function dedupePantryRows<T extends PantryMergeRow>(
  items: T[],
  identity: PantryMergeIdentity,
): T[] {
  const sorted = stableSortByName(items, identity.identityKey);
  const merged: T[] = [];

  for (const row of sorted) {
    const key = identity.identityKey(row.name);
    let matchIndex = -1;
    for (let i = 0; i < merged.length; i += 1) {
      const other = merged[i];
      const otherKey = identity.identityKey(other.name);
      if (key === otherKey || identity.rowsMatch(row.name, other.name)) {
        matchIndex = i;
        break;
      }
    }
    if (matchIndex >= 0) {
      merged[matchIndex] = mergePantryRowPair(merged[matchIndex], row);
    } else {
      merged.push(row);
    }
  }
  return stableSortByName(merged, identity.identityKey);
}

/** Union enumerate + verify passes without inflating quantities. */
export function mergePantryPasses<T extends PantryMergeRow>(
  passA: T[],
  passB: T[],
  identity: PantryMergeIdentity,
): T[] {
  return dedupePantryRows([...passA, ...passB], identity);
}

export function pantryRowsSeemCompleteForSinglePass(
  items: PantryMergeRow[],
  minItems: number,
  minAvgConfidence: number,
): boolean {
  if (items.length < minItems) return false;
  const avg = items.reduce((sum, row) => sum + row.confidence, 0) / items.length;
  return avg >= minAvgConfidence;
}

/** Run add-missing (verify) pass unless the wall-clock budget cannot fit another Gemini call. */
export function shouldRunPantryVerifySecondPass(budgetExhausted: boolean): boolean {
  return !budgetExhausted;
}
