export const SEAMLESS_FLOW_COPY = {
  sheetTitle: 'When do you want to cook this?',
  cookNow: 'Cook now',
  planIt: 'Plan it',
  justSave: 'Just save it',
  grabIt: "I'll grab it",
  swapIt: 'Swap it',
  moreDates: 'More dates',
  cookThis: 'Cook this',
  cookThisAccessibility: 'Cook this recipe',
  missingHeading: (count: number) =>
    count === 1 ? '1 thing missing' : `${count} things missing`,
  swapSuggestion: (name: string) => `Try ${name} instead`,
  plannedToast: (label: string) => `Planned for ${label}`,
} as const;
