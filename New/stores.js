const STORES_KEY = '209-meal-prep-stores';
const TRIPS_KEY = '209-meal-prep-trips';

function createStoreId() {
  return `store-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeUrl(value) {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function getStores() {
  try {
    const stores = JSON.parse(localStorage.getItem(STORES_KEY) || '[]');
    return Array.isArray(stores) ? stores : [];
  } catch (error) {
    return [];
  }
}

function saveStores(stores) {
  localStorage.setItem(STORES_KEY, JSON.stringify(stores));
}

function addStore(input) {
  const store = {
    id: createStoreId(),
    name: (input.name || '').trim() || 'Local store',
    url: normalizeUrl(input.url),
    searchUrlTemplate: (input.searchUrlTemplate || '').trim(),
    notes: (input.notes || '').trim(),
    typicalItems: String(input.typicalItems || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    createdAt: new Date().toISOString()
  };
  const stores = getStores();
  stores.push(store);
  saveStores(stores);
  addRecord({
    kind: 'store',
    origin: 'input',
    source: 'Kitchen input',
    citation: `Saved store ${store.name}`,
    url: store.url,
    subjectType: 'store',
    subjectId: store.id,
    values: store
  });
  return store;
}

function updateStore(id, patch) {
  const stores = getStores().map((store) => {
    if (store.id !== id) return store;
    return {
      ...store,
      name: patch.name !== undefined ? patch.name.trim() : store.name,
      url: patch.url !== undefined ? normalizeUrl(patch.url) : store.url,
      searchUrlTemplate: patch.searchUrlTemplate !== undefined ? patch.searchUrlTemplate.trim() : store.searchUrlTemplate,
      notes: patch.notes !== undefined ? patch.notes.trim() : store.notes,
      typicalItems: patch.typicalItems !== undefined
        ? String(patch.typicalItems).split(',').map((item) => item.trim()).filter(Boolean)
        : store.typicalItems
    };
  });
  saveStores(stores);
  return stores.find((store) => store.id === id);
}

function removeStore(id) {
  saveStores(getStores().filter((store) => store.id !== id));
}

function storeSearchUrl(store, query) {
  if (!store) return '';
  if (store.searchUrlTemplate && store.searchUrlTemplate.includes('{query}')) {
    return store.searchUrlTemplate.replace('{query}', encodeURIComponent(query));
  }
  if (store.url) return store.url;
  return '';
}

function matchStoreForIngredient(ingredient, stores) {
  if (ingredient.storeId) {
    return stores.find((store) => store.id === ingredient.storeId) || null;
  }
  const hay = `${ingredient.name || ''} ${ingredient.notes || ''}`.toLowerCase();
  return stores.find((store) => {
    const needles = [store.name, ...(store.typicalItems || []), store.notes]
      .join(' ')
      .toLowerCase()
      .split(/[\s,]+/)
      .filter((word) => word.length > 3);
    return needles.some((word) => hay.includes(word));
  }) || null;
}

function collectTripIngredients(recipeIds) {
  const wanted = new Set(recipeIds);
  const recipes = getRecipes().filter((recipe) => wanted.has(recipe.id));
  const rows = [];
  recipes.forEach((recipe) => {
    const portions = Number(recipe.yieldPortions) || 1;
    (recipe.ingredients || []).forEach((ingredient) => {
      rows.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        ingredientId: ingredient.id,
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
        grams: Number(ingredient.grams) || 0,
        cost: Number(ingredient.cost) || 0,
        storeId: ingredient.storeId || '',
        notes: ingredient.notes || '',
        portions,
        origin: ingredient.origin || (ingredient.fdcId ? 'sourced' : 'input')
      });
    });
  });
  return { recipes, rows };
}

function planShoppingTrip(recipeIds, label) {
  const stores = getStores();
  const { recipes, rows } = collectTripIngredients(recipeIds);
  const groups = new Map();

  function bucketFor(store) {
    const key = store ? store.id : 'unassigned';
    if (!groups.has(key)) {
      groups.set(key, {
        storeId: store ? store.id : '',
        storeName: store ? store.name : 'Unassigned / ask David',
        storeUrl: store ? store.url : '',
        items: []
      });
    }
    return groups.get(key);
  }

  rows.forEach((row) => {
    const store = matchStoreForIngredient(row, stores);
    const item = {
      ...row,
      storeName: store ? store.name : '',
      storeUrl: store ? store.url : '',
      searchUrl: storeSearchUrl(store, row.name)
    };
    bucketFor(store).items.push(item);
  });

  const trip = {
    id: `trip-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    label: label || `Shop for ${recipes.map((recipe) => recipe.name).join(', ') || 'selected meals'}`,
    recipeIds,
    groups: Array.from(groups.values())
  };

  const trips = getTrips();
  trips.unshift(trip);
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips.slice(0, 50)));

  addRecord({
    kind: 'shopping-trip',
    origin: 'input',
    source: 'Kitchen shopping planner',
    citation: trip.label,
    subjectType: 'trip',
    subjectId: trip.id,
    values: {
      recipeIds,
      storeCount: trip.groups.filter((group) => group.storeId).length,
      itemCount: rows.length
    }
  });

  return trip;
}

function getTrips() {
  try {
    const trips = JSON.parse(localStorage.getItem(TRIPS_KEY) || '[]');
    return Array.isArray(trips) ? trips : [];
  } catch (error) {
    return [];
  }
}
