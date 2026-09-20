const STORES_KEY = '209-meal-prep-stores';
const TRIPS_KEY = '209-meal-prep-trips';

function createStoreId() {
  return `store-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function createTripItemId() {
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeUrl(value) {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function logShoppingRecord(entry) {
  if (typeof addRecord === 'function') addRecord(entry);
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

function parseTypicalItems(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function addStore(input) {
  const store = {
    id: createStoreId(),
    name: (input.name || '').trim() || 'Local store',
    url: normalizeUrl(input.url),
    searchUrlTemplate: (input.searchUrlTemplate || '').trim(),
    notes: (input.notes || '').trim(),
    typicalItems: parseTypicalItems(input.typicalItems),
    createdAt: new Date().toISOString()
  };
  const stores = getStores();
  stores.push(store);
  saveStores(stores);
  logShoppingRecord({
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
        ? parseTypicalItems(patch.typicalItems)
        : store.typicalItems,
      updatedAt: new Date().toISOString()
    };
  });
  saveStores(stores);
  const updated = stores.find((store) => store.id === id);
  if (updated) {
    logShoppingRecord({
      kind: 'store',
      origin: 'input',
      source: 'Kitchen shopping planner',
      citation: `Updated store ${updated.name}`,
      url: updated.url,
      subjectType: 'store',
      subjectId: updated.id,
      values: updated
    });
  }
  return updated;
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

function storeMatchNeedles(store) {
  const phrases = [...(store.typicalItems || [])]
    .map((item) => String(item).trim().toLowerCase())
    .filter((item) => item.length > 2);
  const words = [store.name, store.notes]
    .join(' ')
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((word) => word.length > 3);
  return [...new Set([...phrases, ...words])];
}

function matchStoreForIngredient(ingredient, stores) {
  if (ingredient.storeId) {
    return stores.find((store) => store.id === ingredient.storeId) || null;
  }
  if (ingredient.manualStore) return null;
  const hay = `${ingredient.name || ''} ${ingredient.notes || ''}`.toLowerCase();
  return stores.find((store) => storeMatchNeedles(store).some((needle) => hay.includes(needle))) || null;
}

function inferredShoppingNeeds(recipe) {
  const skip = /^(slow-smoked|sliced|tender|grilled|roasted|oven-finished|chili-lime|char-grilled|seasoned|marinated|crispy|smoked|served|over|with|and|the|a|an|of)$/i;
  const chunks = `${recipe.name || ''} ${recipe.description || ''}`
    .split(/,|;|\/|&| and | with | over | plus | served with /i)
    .map((chunk) => chunk.replace(/\b(bowl|sauce|drizzle|jus|glaze|gravy|salsa|dressing)\b/gi, '').trim())
    .filter((chunk) => chunk.length > 3 && !skip.test(chunk));
  const unique = [];
  chunks.forEach((name) => {
    const key = name.toLowerCase();
    if (unique.some((item) => item.toLowerCase() === key)) return;
    unique.push(name);
  });
  return unique.slice(0, 8).map((name, index) => ({
    id: `${recipe.id}-need-${index}`,
    name,
    amount: '',
    unit: '',
    grams: 0,
    cost: 0,
    storeId: '',
    notes: 'Inferred from menu copy until a Recipes-tab ingredient line is saved',
    origin: 'inferred'
  }));
}

function collectTripIngredients(recipeIds) {
  const wanted = new Set(recipeIds);
  const recipes = (typeof getRecipes === 'function' ? getRecipes() : []).filter((recipe) => wanted.has(recipe.id));
  const rows = [];
  recipes.forEach((recipe) => {
    const portions = Number(recipe.yieldPortions) || 1;
    const ingredients = (recipe.ingredients && recipe.ingredients.length)
      ? recipe.ingredients
      : inferredShoppingNeeds(recipe);
    ingredients.forEach((ingredient) => {
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

function decorateTripItem(row, store) {
  return {
    ...row,
    id: row.id || row.ingredientId || createTripItemId(),
    checked: Boolean(row.checked),
    manualStore: Boolean(row.manualStore),
    storeId: store ? store.id : (row.storeId || ''),
    storeName: store ? store.name : (row.storeName || ''),
    storeUrl: store ? store.url : (row.storeUrl || ''),
    searchUrl: storeSearchUrl(store, row.name)
  };
}

function aggregateGroupItems(items) {
  const buckets = new Map();
  items.forEach((item) => {
    const key = `${String(item.name || '').toLowerCase()}|${String(item.unit || '').toLowerCase()}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        ...item,
        id: item.id || createTripItemId(),
        recipeIds: [item.recipeId].filter(Boolean),
        recipeNames: [item.recipeName].filter(Boolean)
      });
      return;
    }
    const current = buckets.get(key);
    current.grams = (Number(current.grams) || 0) + (Number(item.grams) || 0);
    current.cost = (Number(current.cost) || 0) + (Number(item.cost) || 0);
    if (item.recipeId && !current.recipeIds.includes(item.recipeId)) current.recipeIds.push(item.recipeId);
    if (item.recipeName && !current.recipeNames.includes(item.recipeName)) current.recipeNames.push(item.recipeName);
    current.recipeName = current.recipeNames.join(', ');
    current.checked = current.checked && item.checked;
  });
  return Array.from(buckets.values());
}

function groupTripItems(rows, stores) {
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
    bucketFor(store).items.push(decorateTripItem(row, store));
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    items: aggregateGroupItems(group.items)
  })).filter((group) => group.items.length);
}

function getTrips() {
  try {
    const trips = JSON.parse(localStorage.getItem(TRIPS_KEY) || '[]');
    return Array.isArray(trips) ? trips : [];
  } catch (error) {
    return [];
  }
}

function saveTrips(trips) {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips.slice(0, 50)));
}

function getTrip(id) {
  return getTrips().find((trip) => trip.id === id) || null;
}

function upsertTrip(trip) {
  const trips = getTrips().filter((item) => item.id !== trip.id);
  trips.unshift(trip);
  saveTrips(trips);
  return trip;
}

function removeTrip(id) {
  saveTrips(getTrips().filter((trip) => trip.id !== id));
}

function rebuildTripGroups(items) {
  return groupTripItems(items, getStores());
}

function tripItems(trip) {
  return (trip.groups || []).flatMap((group) => group.items || []);
}

function planShoppingTrip(recipeIds, label) {
  const stores = getStores();
  const { recipes, rows } = collectTripIngredients(recipeIds);
  const groups = groupTripItems(rows, stores);
  const trip = {
    id: `trip-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    label: label || `Shop for ${recipes.map((recipe) => recipe.name).join(', ') || 'selected meals'}`,
    recipeIds: [...recipeIds],
    groups
  };

  upsertTrip(trip);
  logShoppingRecord({
    kind: 'shopping-trip',
    origin: 'input',
    source: 'Kitchen shopping planner',
    citation: trip.label,
    subjectType: 'trip',
    subjectId: trip.id,
    values: {
      recipeIds,
      storeCount: trip.groups.filter((group) => group.storeId).length,
      itemCount: tripItems(trip).length
    }
  });

  return trip;
}

function setTripItemChecked(tripId, itemId, checked) {
  const trip = getTrip(tripId);
  if (!trip) return null;
  trip.groups = trip.groups.map((group) => ({
    ...group,
    items: group.items.map((item) => (
      item.id === itemId ? { ...item, checked: Boolean(checked) } : item
    ))
  }));
  return upsertTrip(trip);
}

function assignTripItemStore(tripId, itemId, storeId) {
  const trip = getTrip(tripId);
  if (!trip) return null;
  const stores = getStores();
  const store = stores.find((item) => item.id === storeId) || null;
  const items = tripItems(trip).map((item) => {
    if (item.id !== itemId) return item;
    return decorateTripItem({
      ...item,
      storeId: store ? store.id : '',
      manualStore: true
    }, store);
  });
  trip.groups = rebuildTripGroups(items);
  return upsertTrip(trip);
}

function shoppingExportHeaders() {
  return [
    'trip_id', 'trip_label', 'created_at', 'store', 'store_url', 'search_url',
    'ingredient', 'amount', 'unit', 'grams', 'cost', 'recipe', 'origin', 'checked', 'notes'
  ];
}

function shoppingExportRows(trip) {
  const rows = [];
  (trip.groups || []).forEach((group) => {
    group.items.forEach((item) => {
      rows.push({
        trip_id: trip.id,
        trip_label: trip.label,
        created_at: trip.createdAt || '',
        store: group.storeName,
        store_url: group.storeUrl || item.storeUrl || '',
        search_url: item.searchUrl || '',
        ingredient: item.name,
        amount: item.amount || '',
        unit: item.unit || '',
        grams: item.grams || '',
        cost: item.cost || '',
        recipe: item.recipeName || (item.recipeNames || []).join(', '),
        origin: item.origin || '',
        checked: item.checked ? 'yes' : 'no',
        notes: item.notes || ''
      });
    });
  });
  return rows;
}

function exportShoppingTrip(trip) {
  const headers = shoppingExportHeaders();
  const rows = shoppingExportRows(trip);
  if (typeof downloadCsv === 'function') {
    downloadCsv(`209-shopping-${trip.id}.csv`, headers, rows);
  }
  if (typeof downloadXlsx === 'function') {
    downloadXlsx(`209-shopping-${trip.id}.xlsx`, [
      { name: 'Shopping trip', rows: [headers, ...rows.map((row) => headers.map((key) => row[key]))] }
    ]);
  }
  logShoppingRecord({
    kind: 'export',
    origin: 'input',
    source: 'Kitchen shopping planner',
    citation: `Exported shopping trip ${trip.label}`,
    subjectType: 'trip',
    subjectId: trip.id,
    values: { itemCount: rows.length }
  });
  return rows;
}
