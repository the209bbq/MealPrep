const AVAILABILITY_KEY = '209-meal-prep-availability';
const RECIPE_OVERRIDES_KEY = '209-meal-prep-recipe-overrides';
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

function slugify(value) {
  return String(value || 'recipe')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'recipe';
}

function createRecipeId(name) {
  return `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
}

function createIngredientId() {
  return `ing-${Math.random().toString(36).slice(2, 8)}`;
}

function readSavedAvailability() {
  try {
    return JSON.parse(localStorage.getItem(AVAILABILITY_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

function readRecipeOverrides() {
  try {
    const saved = JSON.parse(localStorage.getItem(RECIPE_OVERRIDES_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

function saveRecipeOverrides(recipes) {
  localStorage.setItem(RECIPE_OVERRIDES_KEY, JSON.stringify(recipes));
}

function blankIngredient() {
  return {
    id: createIngredientId(),
    name: '',
    amount: '',
    unit: 'g',
    grams: '',
    cost: '',
    storeId: '',
    notes: '',
    fdcId: '',
    source: '',
    citation: '',
    url: '',
    sourcedAt: '',
    sourcedNutrition: emptyNutrition(),
    inputNutrition: {},
    origin: 'input'
  };
}

function normalizeIngredient(raw) {
  const base = blankIngredient();
  const next = { ...base, ...(raw || {}), id: raw?.id || base.id };
  next.sourcedNutrition = sanitizeNutrition(raw?.sourcedNutrition);
  next.inputNutrition = raw?.inputNutrition && typeof raw.inputNutrition === 'object' ? raw.inputNutrition : {};
  const merged = effectiveNutrition(next.sourcedNutrition, next.inputNutrition);
  next.nutrition = merged.effective;
  next.nutritionOrigins = merged.origins;
  next.origin = raw?.origin || (next.fdcId ? 'sourced' : 'input');
  return next;
}

function catalogNutrition(recipe) {
  const sourced = emptyNutrition();
  sourced.calories = Number(recipe.calories) || 0;
  sourced.protein = Number(recipe.protein) || 0;
  return sourced;
}

function applyRecipeNutrition(recipe) {
  const ingredientNutrition = sumNutrition((recipe.ingredients || []).map((item) => item.nutrition));
  const fromIngredients = nutritionHasValues(ingredientNutrition);
  const sourced = fromIngredients ? ingredientNutrition : sanitizeNutrition(recipe.sourcedNutrition);
  const inputted = recipe.inputNutrition || {};
  const merged = effectiveNutrition(sourced, inputted);
  return {
    ...recipe,
    sourcedNutrition: sourced,
    nutrition: merged.effective,
    nutritionOrigins: merged.origins,
    nutritionOrigin: Object.values(merged.origins).includes('input') && Object.values(merged.origins).includes('sourced')
      ? 'mixed'
      : (Object.values(merged.origins).includes('input') ? 'input' : (fromIngredients || nutritionHasValues(sourced) ? 'sourced' : 'unset')),
    calories: merged.effective.calories,
    protein: merged.effective.protein,
    carbs: merged.effective.carbs,
    fat: merged.effective.fat,
    fiber: merged.effective.fiber,
    sodium: merged.effective.sodium,
    potassium: merged.effective.potassium,
    calcium: merged.effective.calcium,
    iron: merged.effective.iron
  };
}

function hydrateRecipe(recipe) {
  const ingredients = (recipe.ingredients || []).map(normalizeIngredient);
  return applyRecipeNutrition({
    yieldPortions: 10,
    portionGrams: '',
    instructions: '',
    nutritionCitation: '',
    nutritionSource: '',
    nutritionSourcedAt: '',
    inputNutrition: {},
    sourcedNutrition: emptyNutrition(),
    custom: false,
    ...recipe,
    ingredients
  });
}

function recipeCost(recipe) {
  return (recipe.ingredients || []).reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
}

function recipeCostPerPortion(recipe) {
  const portions = Number(recipe.yieldPortions) || 1;
  return recipeCost(recipe) / portions;
}

function getRecipeLibrary() {
  const overrides = readRecipeOverrides();
  const overrideMap = new Map(overrides.map((recipe) => [recipe.id, recipe]));
  const catalog = RECIPE_CATALOG.map((recipe) => {
    const extra = overrideMap.get(recipe.id);
    return hydrateRecipe({
      ...recipe,
      sourcedNutrition: catalogNutrition(recipe),
      nutritionSource: extra?.nutritionSource || '209 catalog',
      nutritionCitation: extra?.nutritionCitation || 'Original 209 Meal Prep menu values',
      ...extra,
      id: recipe.id,
      custom: false
    });
  });
  const extras = overrides.filter((recipe) => !RECIPE_CATALOG.some((item) => item.id === recipe.id)).map(hydrateRecipe);
  return [...catalog, ...extras];
}

function getRecipes() {
  const saved = readSavedAvailability();
  return getRecipeLibrary().map((recipe) => {
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

function upsertSavedRecipe(recipe) {
  const hydrated = hydrateRecipe(recipe);
  const overrides = readRecipeOverrides().filter((item) => item.id !== hydrated.id);
  overrides.push(hydrated);
  saveRecipeOverrides(overrides);
  addRecord({
    kind: 'recipe',
    origin: 'input',
    source: 'Kitchen recipe lab',
    citation: `Saved recipe ${hydrated.name}`,
    subjectType: 'recipe',
    subjectId: hydrated.id,
    values: {
      name: hydrated.name,
      yieldPortions: hydrated.yieldPortions,
      calories: hydrated.calories,
      protein: hydrated.protein,
      carbs: hydrated.carbs,
      fat: hydrated.fat,
      ingredientCount: (hydrated.ingredients || []).length,
      cost: recipeCost(hydrated)
    }
  });
  return getRecipes().find((item) => item.id === hydrated.id);
}

function deleteSavedRecipe(id) {
  if (RECIPE_CATALOG.some((recipe) => recipe.id === id)) {
    saveRecipeOverrides(readRecipeOverrides().filter((recipe) => recipe.id !== id));
    return;
  }
  saveRecipeOverrides(readRecipeOverrides().filter((recipe) => recipe.id !== id));
}

function nutritionLabel(recipe) {
  const parts = [`${recipe.calories || 0} Cal`, `${recipe.protein || 0}g Protein`];
  if (recipe.carbs) parts.push(`${recipe.carbs}g Carbs`);
  if (recipe.fat) parts.push(`${recipe.fat}g Fat`);
  return parts.join(' | ');
}
