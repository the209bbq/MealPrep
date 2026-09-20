const USDA_SEARCH = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const USDA_FOOD = 'https://api.nal.usda.gov/fdc/v1/food';
const USDA_NUTRIENT_IDS = {
  calories: [1008, 2047, 2048],
  protein: [1003],
  carbs: [1005],
  fat: [1004],
  fiber: [1079],
  sodium: [1093],
  potassium: [1092],
  calcium: [1087],
  iron: [1089]
};

function usdaKeyForRequest() {
  return getUsdaApiKey() || 'DEMO_KEY';
}

function readNutrientNumber(food, ids) {
  const nutrients = food.foodNutrients || [];
  for (const id of ids) {
    const match = nutrients.find((item) => {
      const nutrientId = item.nutrientId || item.nutrient?.id || item.nutrientNumber;
      return Number(nutrientId) === Number(id) || String(item.nutrientNumber) === String(id);
    });
    if (match) {
      const value = match.value ?? match.amount;
      if (Number.isFinite(Number(value))) return Number(value);
    }
  }
  return 0;
}

function nutritionFromUsdaFood(food) {
  const nutrition = emptyNutrition();
  Object.keys(USDA_NUTRIENT_IDS).forEach((field) => {
    nutrition[field] = roundNutrition(readNutrientNumber(food, USDA_NUTRIENT_IDS[field]), field);
  });
  return nutrition;
}

function scaleNutrition(nutrition, grams) {
  const qty = Number(grams);
  const factor = Number.isFinite(qty) && qty > 0 ? qty / 100 : 1;
  const scaled = emptyNutrition();
  Object.keys(scaled).forEach((field) => {
    scaled[field] = roundNutrition(nutrition[field] * factor, field);
  });
  return scaled;
}

function sumNutrition(list) {
  const total = emptyNutrition();
  list.forEach((item) => {
    const nutrition = sanitizeNutrition(item);
    Object.keys(total).forEach((field) => {
      total[field] = roundNutrition(total[field] + nutrition[field], field);
    });
  });
  return total;
}

function usdaCitation(food) {
  const name = food.description || food.lowercaseDescription || 'USDA food';
  const fdcId = food.fdcId;
  const dataType = food.dataType || 'FoodData Central';
  return {
    source: 'USDA FoodData Central',
    citation: `${name} (FDC ID ${fdcId}, ${dataType})`,
    url: `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`,
    fdcId
  };
}

async function usdaFetch(url) {
  const local = url.startsWith('/api/');
  const response = await fetch(local ? url : url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`USDA lookup failed (${response.status}). Check the API key in Kitchen settings.`);
  }
  return response.json();
}

async function searchUsdaFoods(query, pageSize = 8) {
  const q = (query || '').trim();
  if (!q) return [];

  const params = new URLSearchParams({
    query: q,
    pageSize: String(pageSize),
    dataType: 'Foundation,SR Legacy,Survey (FNDDS)'
  });

  let data;
  try {
    data = await usdaFetch(`/api/usda/search?${params.toString()}`);
  } catch (error) {
    params.set('api_key', usdaKeyForRequest());
    data = await usdaFetch(`${USDA_SEARCH}?${params.toString()}`);
  }

  return (data.foods || []).map((food) => {
    const cite = usdaCitation(food);
    return {
      fdcId: food.fdcId,
      name: food.description,
      dataType: food.dataType,
      brand: food.brandOwner || '',
      nutritionPer100g: nutritionFromUsdaFood(food),
      ...cite
    };
  });
}

async function getUsdaFood(fdcId, grams) {
  let food;
  try {
    food = await usdaFetch(`/api/usda/food/${encodeURIComponent(fdcId)}`);
  } catch (error) {
    const params = new URLSearchParams({ api_key: usdaKeyForRequest() });
    food = await usdaFetch(`${USDA_FOOD}/${encodeURIComponent(fdcId)}?${params.toString()}`);
  }

  const cite = usdaCitation(food);
  const per100g = nutritionFromUsdaFood(food);
  const scaled = scaleNutrition(per100g, grams);
  return {
    food,
    per100g,
    scaled,
    grams: Number(grams) || 100,
    ...cite
  };
}

async function sourceIngredientNutrition(ingredient) {
  const grams = Number(ingredient.grams) || 100;
  const result = await getUsdaFood(ingredient.fdcId, grams);
  return {
    sourcedNutrition: result.scaled,
    sourcedPer100g: result.per100g,
    source: result.source,
    citation: result.citation,
    url: result.url,
    fdcId: result.fdcId,
    sourcedAt: new Date().toISOString(),
    origin: 'sourced'
  };
}
