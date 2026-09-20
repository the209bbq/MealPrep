function parseList(text) {
  return String(text || '')
    .split(/,| and | with | plus |\n/i)
    .map((item) => item.replace(/^(a|an|some)\s+/i, '').trim())
    .filter((item) => item.length > 2);
}

function guessTag(name, description) {
  const hay = `${name} ${description}`.toLowerCase();
  if (hay.includes('veggie') || hay.includes('chickpea') || hay.includes('tofu')) return 'Plant Forward';
  if (hay.includes('buffalo') || hay.includes('protein')) return 'High Protein';
  if (hay.includes('cauliflower') || hay.includes('low carb')) return 'Low Carb';
  if (hay.includes('smoke') || hay.includes('brisket') || hay.includes('pork') || hay.includes('carnitas')) return 'Signature Smoked';
  return 'Lean & Clean';
}

async function lookupIngredientDraft(name, grams) {
  const matches = await searchUsdaFoods(name, 3);
  const top = matches[0];
  const ingredient = normalizeIngredient({
    name,
    amount: grams,
    unit: 'g',
    grams,
    origin: top ? 'sourced' : 'input'
  });
  if (!top) return ingredient;
  const detail = await getUsdaFood(top.fdcId, grams);
  ingredient.fdcId = detail.fdcId;
  ingredient.source = detail.source;
  ingredient.citation = detail.citation;
  ingredient.url = detail.url;
  ingredient.sourcedAt = new Date().toISOString();
  ingredient.sourcedNutrition = detail.scaled;
  addRecord({
    kind: 'usda',
    origin: 'sourced',
    source: detail.source,
    citation: detail.citation,
    url: detail.url,
    subjectType: 'ingredient',
    subjectId: ingredient.id,
    values: {
      name,
      grams,
      fdcId: detail.fdcId,
      nutrition: detail.scaled
    }
  });
  return normalizeIngredient(ingredient);
}

async function draftRecipeFromPrompt(prompt) {
  const cleaned = prompt.replace(/^(make|create|draft|build|new recipe[:\s-]*)/i, '').trim();
  const [namePart, rest] = cleaned.split(/[:\-–]| with /i);
  const name = (namePart || cleaned).trim().slice(0, 80) || 'New smoked bowl';
  const ingredientNames = parseList(rest || cleaned).filter((item) => item.toLowerCase() !== name.toLowerCase()).slice(0, 8);
  const unique = [...new Set(ingredientNames.length ? ingredientNames : parseList(cleaned))];
  const ingredients = [];
  for (const item of unique.slice(0, 6)) {
    try {
      ingredients.push(await lookupIngredientDraft(item, 120));
    } catch (error) {
      ingredients.push(normalizeIngredient({ name: item, grams: 120, amount: 120, unit: 'g' }));
    }
  }
  return hydrateRecipe({
    id: createRecipeId(name),
    custom: true,
    tag: guessTag(name, prompt),
    name,
    description: `Kitchen draft from assistant: ${prompt}`,
    instructions: 'Smoke or cook the protein, roast the sides, portion into meal-prep trays.',
    yieldPortions: 10,
    onThisWeek: false,
    soldOut: false,
    ingredients
  });
}

function assistantHelp() {
  return [
    'I can help run 209 Meal Prep from this kitchen board — not just chat.',
    'Try:',
    '• “draft smoked turkey bowl with wild rice and carrots”',
    '• “lookup USDA chicken breast”',
    '• “shop this week” or “plan shopping”',
    '• “export spreadsheets”',
    'Use the forms to type your own costs, yields, nutrition overrides, and store websites. Sourced USDA numbers stay next to your inputs.'
  ].join('\n');
}

async function runAssistant(message) {
  const text = (message || '').trim();
  const lower = text.toLowerCase();
  if (!text || lower === 'help') {
    return { type: 'text', text: assistantHelp() };
  }
  if (/export|spreadsheet|csv|xlsx|workbook/.test(lower)) {
    exportBusinessWorkbook();
    return { type: 'text', text: 'Downloaded CSV files plus a 209-meal-prep-workbook.xlsx with recipes, ingredients, input vs sourced nutrition, and sourced records.' };
  }
  if (/shop|shopping|trip|grocery/.test(lower)) {
    const weekly = getWeeklyMenu();
    if (!weekly.length) {
      return { type: 'text', text: 'Nothing is on this week’s menu yet. Toggle meals on, or pick recipes in the shopping tab.' };
    }
    const trip = planShoppingTrip(weekly.map((recipe) => recipe.id), 'This week’s menu');
    return { type: 'trip', trip, text: `Planned a shopping trip for ${weekly.length} menu items, grouped by your saved stores.` };
  }
  if (/lookup|usda|nutrition for|source/.test(lower)) {
    const query = text.replace(/^(lookup|usda|nutrition for|source)\s+/i, '').trim();
    const foods = await searchUsdaFoods(query || text, 6);
    foods.forEach((food) => {
      addRecord({
        kind: 'usda-search',
        origin: 'sourced',
        source: food.source,
        citation: food.citation,
        url: food.url,
        subjectType: 'food',
        subjectId: String(food.fdcId),
        values: { query, nutritionPer100g: food.nutritionPer100g }
      });
    });
    if (!foods.length) {
      return { type: 'text', text: `No USDA matches for “${query}”. Add your own values in the ingredient row.` };
    }
    return { type: 'usda', foods, text: `USDA FoodData Central hits for “${query}”. Click one to drop it into the open recipe.` };
  }
  if (/make|create|draft|build|recipe|bowl|new /.test(lower)) {
    const recipe = await draftRecipeFromPrompt(text);
    return { type: 'recipe', recipe, text: `Drafted ${recipe.name} with ${recipe.ingredients.length} ingredients. Review costs/yields, then save.` };
  }
  return { type: 'text', text: `${assistantHelp()}\n\nI also saved nothing for “${text}” — tell me to draft, lookup, shop, or export.` };
}
