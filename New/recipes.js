const AVAILABILITY_KEY = '209-meal-prep-availability';
const PLAN_PRICES = {
  5: 12.00,
  10: 11.00,
  15: 10.00
};

const RECIPE_CATALOG = [
  {
    id: 'brisket',
    tag: 'Signature Smoked',
    name: 'Smoked Lean Brisket & Sweet Potato',
    description: 'Slow-smoked sliced brisket served with roasted sweet potato wedges and steamed green beans.',
    calories: 520,
    protein: 45,
    onThisWeek: true,
    soldOut: false
  },
  {
    id: 'lemon-chicken',
    tag: 'Lean & Clean',
    name: 'Grilled Lemon Herb Chicken',
    description: 'Char-grilled chicken breast over Jasmine rice with garlic broccoli and citrus drizzle.',
    calories: 480,
    protein: 42,
    onThisWeek: true,
    soldOut: false
  },
  {
    id: 'pulled-pork',
    tag: 'Low Carb',
    name: 'Pulled Pork Bowl',
    description: 'Tender slow-smoked pulled pork served over seasoned cauliflower rice with cilantro-lime slaw.',
    calories: 440,
    protein: 38,
    onThisWeek: true,
    soldOut: false
  },
  {
    id: 'turkey-rice',
    tag: 'Signature Smoked',
    name: 'Smoked Turkey & Wild Rice',
    description: 'Sliced smoked turkey breast with wild rice pilaf, roasted carrots, and a light herb gravy.',
    calories: 470,
    protein: 44,
    onThisWeek: true,
    soldOut: false
  },
  {
    id: 'chipotle-shrimp',
    tag: 'Lean & Clean',
    name: 'Chipotle Lime Shrimp',
    description: 'Chili-lime shrimp over cilantro rice with black beans, grilled corn, and avocado salsa.',
    calories: 430,
    protein: 36,
    onThisWeek: true,
    soldOut: false
  },
  {
    id: 'herb-salmon',
    tag: 'Lean & Clean',
    name: 'Herb Salmon & Asparagus',
    description: 'Oven-finished salmon with garlic asparagus, lemon quinoa, and a dill yogurt sauce.',
    calories: 510,
    protein: 40,
    onThisWeek: true,
    soldOut: false
  },
  {
    id: 'steak-tips',
    tag: 'Signature Smoked',
    name: 'Steak Tips & Garlic Potatoes',
    description: 'Smoked sirloin tips with roasted garlic potatoes, green beans, and peppercorn jus.',
    calories: 560,
    protein: 46,
    onThisWeek: false,
    soldOut: false
  },
  {
    id: 'buffalo-chicken',
    tag: 'High Protein',
    name: 'Buffalo Chicken Bowl',
    description: 'Grilled chicken tossed in buffalo sauce over rice with celery slaw and ranch drizzle.',
    calories: 490,
    protein: 48,
    onThisWeek: false,
    soldOut: false
  },
  {
    id: 'carnitas',
    tag: 'Signature Smoked',
    name: 'Carnitas Street Bowl',
    description: 'Crispy smoked carnitas with cilantro-lime rice, pico de gallo, and pickled onions.',
    calories: 530,
    protein: 41,
    onThisWeek: false,
    soldOut: false
  },
  {
    id: 'korean-beef',
    tag: 'Signature Smoked',
    name: 'Korean BBQ Beef',
    description: 'Marinated smoked beef with steamed rice, sesame broccoli, and a gochujang glaze.',
    calories: 540,
    protein: 43,
    onThisWeek: false,
    soldOut: false
  },
  {
    id: 'smash-burger',
    tag: 'High Protein',
    name: 'Smash Burger Bowl',
    description: 'Seasoned beef, roasted potatoes, pickle slaw, and special sauce without the bun.',
    calories: 580,
    protein: 42,
    onThisWeek: false,
    soldOut: false
  },
  {
    id: 'veggie-power',
    tag: 'Plant Forward',
    name: 'Roasted Veggie Power Bowl',
    description: 'Smoked chickpeas, quinoa, roasted squash, kale, and tahini lemon dressing.',
    calories: 460,
    protein: 24,
    onThisWeek: false,
    soldOut: false
  }
];

function readSavedAvailability() {
  try {
    return JSON.parse(localStorage.getItem(AVAILABILITY_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

function getRecipes() {
  const saved = readSavedAvailability();
  return RECIPE_CATALOG.map((recipe) => {
    const override = saved[recipe.id] || {};
    return {
      ...recipe,
      onThisWeek: override.onThisWeek ?? recipe.onThisWeek,
      soldOut: override.soldOut ?? recipe.soldOut
    };
  });
}

function getWeeklyMenu() {
  return getRecipes().filter((recipe) => recipe.onThisWeek);
}

function updateRecipeAvailability(id, patch) {
  const saved = readSavedAvailability();
  const current = getRecipes().find((recipe) => recipe.id === id);
  if (!current) return;

  saved[id] = {
    onThisWeek: patch.onThisWeek ?? current.onThisWeek,
    soldOut: patch.soldOut ?? current.soldOut
  };

  if (!saved[id].onThisWeek) {
    saved[id].soldOut = false;
  }

  localStorage.setItem(AVAILABILITY_KEY, JSON.stringify(saved));
}

function clearSoldOutFlags() {
  const saved = readSavedAvailability();
  getRecipes().forEach((recipe) => {
    saved[recipe.id] = {
      onThisWeek: recipe.onThisWeek,
      soldOut: false
    };
  });
  localStorage.setItem(AVAILABILITY_KEY, JSON.stringify(saved));
}
