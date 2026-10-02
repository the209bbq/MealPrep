export const PANTRY_RESTOCK_COPY = {
  addedToPantry: (count: number) =>
    `Added ${count} item${count === 1 ? '' : 's'} to pantry`,
} as const;
