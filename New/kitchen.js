const kitchenList = document.getElementById('kitchen-list');
const kitchenSummary = document.getElementById('kitchen-summary');
const clearSoldOutButton = document.getElementById('clear-sold-out');
const ordersList = document.getElementById('orders-list');
const prepTally = document.getElementById('prep-tally');
const tabs = document.querySelectorAll('.kitchen-tab');
const panels = document.querySelectorAll('[data-panel]');

const STATUS_FLOW = ['new', 'prepping', 'packed', 'complete'];
const STATUS_LABELS = {
  new: 'New',
  prepping: 'Prepping',
  packed: 'Packed',
  complete: 'Complete'
};

const NUTRIENT_LABELS = {
  calories: 'Calories',
  protein: 'Protein g',
  carbs: 'Carbs g',
  fat: 'Fat g',
  fiber: 'Fiber g',
  sodium: 'Sodium mg',
  potassium: 'Potassium mg',
  calcium: 'Calcium mg',
  iron: 'Iron mg'
};

let activeRecipeId = '';
let lastTrip = null;

function nextStatus(status) {
  const index = STATUS_FLOW.indexOf(status);
  return STATUS_FLOW[Math.min(index + 1, STATUS_FLOW.length - 1)];
}

function showLabStatus(message) {
  const el = document.getElementById('lab-status');
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || '';
}

function renderKitchen() {
  const recipes = getRecipes();
  const onMenu = recipes.filter((recipe) => recipe.onThisWeek);
  const soldOut = onMenu.filter((recipe) => recipe.soldOut);

  kitchenSummary.textContent = `${onMenu.length} on this week's menu · ${soldOut.length} sold out`;

  kitchenList.innerHTML = recipes.map((recipe) => `
    <article class="kitchen-card ${recipe.onThisWeek ? 'is-on' : ''} ${recipe.soldOut ? 'is-sold-out' : ''}">
      <div class="kitchen-card-copy">
        <span class="card-tag">${escapeHtml(recipe.tag)}</span>
        <h2>${escapeHtml(recipe.name)}</h2>
        <p>${escapeHtml(recipe.description)}</p>
        <span class="calories">${escapeHtml(nutritionLabel(recipe))}</span>
      </div>
      <div class="kitchen-actions">
        <button
          type="button"
          class="toggle-btn ${recipe.onThisWeek ? 'is-active' : ''}"
          data-id="${recipe.id}"
          data-action="week"
        >
          ${recipe.onThisWeek ? 'On this week' : 'Off this week'}
        </button>
        <button
          type="button"
          class="toggle-btn danger ${recipe.soldOut ? 'is-active' : ''}"
          data-id="${recipe.id}"
          data-action="soldout"
          ${recipe.onThisWeek ? '' : 'disabled'}
        >
          ${recipe.soldOut ? 'Sold out' : 'Mark sold out'}
        </button>
      </div>
    </article>
  `).join('');
}

function renderOrders() {
  const orders = getOrders();
  const tally = getOpenPrepTally();
  const tallyItems = Object.entries(tally);

  prepTally.innerHTML = tallyItems.length
    ? `<h2>Still to cook</h2>${tallyItems.map(([name, qty]) => `<span>${qty}× ${escapeHtml(name)}</span>`).join('')}`
    : '<p>No open orders.</p>';

  if (orders.length === 0) {
    ordersList.innerHTML = '<p class="menu-empty">No orders yet. They’ll land here after a customer submits checkout.</p>';
    return;
  }

  ordersList.innerHTML = orders.map((order) => `
    <article class="order-ticket status-${order.status}">
      <header>
        <strong>${escapeHtml(order.id)}</strong>
        <span class="status-pill">${STATUS_LABELS[order.status]}</span>
      </header>
      <p>${escapeHtml(order.name)} · ${escapeHtml(order.phone)}<br>${escapeHtml(order.email)}</p>
      <p>${escapeHtml(order.orderType)}${order.address ? ` · ${escapeHtml(order.address)}` : ''}</p>
      <ul>
        ${order.items.map((item) => `<li>${item.qty}× ${escapeHtml(item.name)}</li>`).join('')}
      </ul>
      <p><strong>$${Number(order.total).toFixed(2)}</strong> · ${order.planCount} meals</p>
      ${order.notes ? `<p class="ticket-notes">${escapeHtml(order.notes)}</p>` : ''}
      ${order.status === 'complete' ? '' : `
        <button type="button" class="toggle-btn is-active" data-advance="${order.id}">
          Mark ${STATUS_LABELS[nextStatus(order.status)]}
        </button>
      `}
    </article>
  `).join('');
}

function renderRecipePick() {
  const mount = document.getElementById('recipe-pick');
  if (!mount) return;
  mount.innerHTML = getRecipes().map((recipe) => `
    <button type="button" class="pick-chip ${recipe.id === activeRecipeId ? 'is-active' : ''}" data-open-recipe="${recipe.id}">
      ${escapeHtml(recipe.name)}
    </button>
  `).join('');
}

function overrideInputs(recipe) {
  return Object.keys(NUTRIENT_LABELS).map((field) => {
    const value = recipe.inputNutrition && recipe.inputNutrition[field] !== undefined && recipe.inputNutrition[field] !== ''
      ? recipe.inputNutrition[field]
      : '';
    return `<label>${NUTRIENT_LABELS[field]} <input type="number" step="0.1" min="0" data-override="${field}" value="${escapeHtml(value)}" /></label>`;
  }).join('');
}

function ingredientRow(ingredient) {
  const stores = getStores();
  const options = [`<option value="">No store assigned</option>`]
    .concat(stores.map((store) => (
      `<option value="${store.id}" ${ingredient.storeId === store.id ? 'selected' : ''}>${escapeHtml(store.name)}</option>`
    )))
    .join('');
  const sourced = nutritionHasValues(ingredient.sourcedNutrition)
    ? `${ingredient.sourcedNutrition.calories} kcal / ${ingredient.sourcedNutrition.protein}g protein sourced`
    : 'No sourced nutrition yet';
  return `
    <article class="ingredient-row" data-ingredient="${ingredient.id}">
      <div class="form-row">
        <label>Ingredient <input type="text" data-field="name" value="${escapeHtml(ingredient.name)}" /></label>
        <label>Amount <input type="text" data-field="amount" value="${escapeHtml(ingredient.amount)}" /></label>
        <label>Unit <input type="text" data-field="unit" value="${escapeHtml(ingredient.unit)}" /></label>
        <label>Grams <input type="number" data-field="grams" value="${escapeHtml(ingredient.grams)}" /></label>
      </div>
      <div class="form-row">
        <label>Cost $ <input type="number" step="0.01" min="0" data-field="cost" value="${escapeHtml(ingredient.cost)}" /></label>
        <label>Shop at <select data-field="storeId">${options}</select></label>
        <label>Notes <input type="text" data-field="notes" value="${escapeHtml(ingredient.notes)}" /></label>
      </div>
      <p class="source-line">${escapeHtml(sourced)}${ingredient.citation ? ` · ${escapeHtml(ingredient.citation)}` : ''}</p>
      <div class="lab-toolbar">
        <button type="button" class="btn-secondary" data-usda="${ingredient.id}">Source USDA</button>
        <button type="button" class="btn-secondary" data-remove-ing="${ingredient.id}">Remove</button>
      </div>
    </article>
  `;
}

function readFormRecipe() {
  const inputNutrition = {};
  document.querySelectorAll('[data-override]').forEach((input) => {
    if (input.value !== '') inputNutrition[input.dataset.override] = Number(input.value);
  });
  const ingredients = Array.from(document.querySelectorAll('.ingredient-row')).map((row) => {
    const current = (getRecipes().find((recipe) => recipe.id === activeRecipeId)?.ingredients || [])
      .find((item) => item.id === row.dataset.ingredient) || blankIngredient();
    const next = { ...current, id: row.dataset.ingredient };
    row.querySelectorAll('[data-field]').forEach((input) => {
      next[input.dataset.field] = input.value;
    });
    return normalizeIngredient(next);
  });
  return hydrateRecipe({
    id: document.getElementById('recipe-id').value || createRecipeId(document.getElementById('recipe-name').value),
    custom: !RECIPE_CATALOG.some((recipe) => recipe.id === document.getElementById('recipe-id').value),
    name: document.getElementById('recipe-name').value.trim(),
    tag: document.getElementById('recipe-tag').value.trim() || 'Kitchen Draft',
    description: document.getElementById('recipe-description').value.trim(),
    instructions: document.getElementById('recipe-instructions').value.trim(),
    yieldPortions: Number(document.getElementById('recipe-yield').value) || 1,
    portionGrams: document.getElementById('recipe-portion-grams').value,
    inputNutrition,
    ingredients,
    onThisWeek: getRecipes().find((recipe) => recipe.id === document.getElementById('recipe-id').value)?.onThisWeek || false,
    soldOut: false
  });
}

function fillRecipeForm(recipe) {
  activeRecipeId = recipe.id;
  document.getElementById('recipe-id').value = recipe.id;
  document.getElementById('recipe-name').value = recipe.name || '';
  document.getElementById('recipe-tag').value = recipe.tag || '';
  document.getElementById('recipe-description').value = recipe.description || '';
  document.getElementById('recipe-instructions').value = recipe.instructions || '';
  document.getElementById('recipe-yield').value = recipe.yieldPortions || 10;
  document.getElementById('recipe-portion-grams').value = recipe.portionGrams || '';
  document.getElementById('override-grid').innerHTML = overrideInputs(recipe);
  document.getElementById('ingredient-list').innerHTML = (recipe.ingredients || []).map(ingredientRow).join('') || '<p class="kitchen-note">No ingredients yet. Add a line or ask the bot to draft.</p>';
  const totals = document.getElementById('lab-totals');
  totals.innerHTML = `
    <p><strong>${escapeHtml(nutritionLabel(recipe))}</strong></p>
    <p>Yield ${recipe.yieldPortions || 1} portions · Ingredient cost ${formatMoney(recipeCost(recipe))} · ${formatMoney(recipeCostPerPortion(recipe))} / portion</p>
    <p class="kitchen-note">Effective nutrition origin: ${escapeHtml(recipe.nutritionOrigin || 'unset')}</p>
  `;
  renderRecipePick();
}

function renderRecords() {
  const mount = document.getElementById('records-list');
  if (!mount) return;
  const records = getRecords().slice(0, 12);
  if (!records.length) {
    mount.innerHTML = '<p class="kitchen-note">Lookups and saves will show here with source, citation, and time.</p>';
    return;
  }
  mount.innerHTML = records.map((record) => `
    <article class="record-item">
      <strong>${escapeHtml(record.kind)} · ${escapeHtml(record.origin)}</strong>
      <span>${escapeHtml(new Date(record.timestamp).toLocaleString())}</span>
      <p>${escapeHtml(record.citation || record.source || '')}</p>
    </article>
  `).join('');
}

function appendAssistant(role, text, extraHtml = '') {
  const log = document.getElementById('assistant-log');
  const item = document.createElement('div');
  item.className = `assistant-msg is-${role}`;
  item.innerHTML = `<strong>${role === 'user' ? 'David' : 'Bot'}</strong><pre>${escapeHtml(text)}</pre>${extraHtml}`;
  log.appendChild(item);
  log.scrollTop = log.scrollHeight;
}

function usdaResultHtml(foods) {
  return `<div class="usda-hits">${foods.map((food) => `
    <button type="button" class="pick-chip" data-apply-food="${food.fdcId}" data-food-name="${escapeHtml(food.name)}">
      ${escapeHtml(food.name)} · ${food.nutritionPer100g.calories} kcal/100g
    </button>
  `).join('')}</div>`;
}

async function applyUsdaToIngredient(ingredientId, query) {
  const recipe = readFormRecipe();
  const ingredient = recipe.ingredients.find((item) => item.id === ingredientId);
  if (!ingredient) return;
  const q = query || ingredient.name;
  const foods = await searchUsdaFoods(q, 5);
  if (!foods.length) {
    showLabStatus(`No USDA match for ${q}. Keep your typed values.`);
    return;
  }
  const detail = await getUsdaFood(foods[0].fdcId, Number(ingredient.grams) || 100);
  ingredient.fdcId = detail.fdcId;
  ingredient.source = detail.source;
  ingredient.citation = detail.citation;
  ingredient.url = detail.url;
  ingredient.sourcedAt = new Date().toISOString();
  ingredient.sourcedNutrition = detail.scaled;
  ingredient.origin = 'sourced';
  addRecord({
    kind: 'usda',
    origin: 'sourced',
    source: detail.source,
    citation: detail.citation,
    url: detail.url,
    subjectType: 'ingredient',
    subjectId: ingredient.id,
    values: { name: ingredient.name, grams: ingredient.grams, nutrition: detail.scaled }
  });
  fillRecipeForm(hydrateRecipe(recipe));
  renderRecords();
  showLabStatus(`Sourced ${ingredient.name} from USDA. Your cost/yield fields were not overwritten.`);
}

function renderStores() {
  const mount = document.getElementById('store-list');
  if (!mount) return;
  const stores = getStores();
  mount.innerHTML = stores.length ? stores.map((store) => `
    <article class="store-card">
      <h3>${escapeHtml(store.name)}</h3>
      <p><a href="${escapeHtml(store.url)}" target="_blank" rel="noopener">${escapeHtml(store.url)}</a></p>
      <p class="kitchen-note">${escapeHtml((store.typicalItems || []).join(', '))}</p>
      <button type="button" class="btn-secondary" data-remove-store="${store.id}">Remove</button>
    </article>
  `).join('') : '<p class="kitchen-note">No stores yet. Add the websites you shop from.</p>';
}

function renderTripRecipePick() {
  const mount = document.getElementById('trip-recipe-pick');
  if (!mount) return;
  mount.innerHTML = getRecipes().map((recipe) => `
    <label class="check-chip">
      <input type="checkbox" value="${recipe.id}" ${recipe.onThisWeek ? 'checked' : ''} />
      ${escapeHtml(recipe.name)}
    </label>
  `).join('');
}

function renderTrip(trip) {
  lastTrip = trip;
  const mount = document.getElementById('trip-result');
  if (!mount || !trip) return;
  mount.innerHTML = `
    <h3>${escapeHtml(trip.label)}</h3>
    ${trip.groups.map((group) => `
      <article class="trip-group">
        <header>
          <strong>${escapeHtml(group.storeName)}</strong>
          ${group.storeUrl ? `<a href="${escapeHtml(group.storeUrl)}" target="_blank" rel="noopener">Open site</a>` : ''}
        </header>
        <ul>
          ${group.items.map((item) => `
            <li>
              ${escapeHtml(item.name)} · ${escapeHtml(item.amount || '')} ${escapeHtml(item.unit || '')}
              ${item.grams ? ` · ${item.grams}g` : ''}
              ${item.cost ? ` · ${formatMoney(item.cost)}` : ''}
              <span class="kitchen-note">for ${escapeHtml(item.recipeName)}</span>
              ${item.searchUrl ? `<a href="${escapeHtml(item.searchUrl)}" target="_blank" rel="noopener">Search</a>` : ''}
            </li>
          `).join('')}
        </ul>
      </article>
    `).join('')}
    <button type="button" class="btn-secondary" id="export-trip">Export this trip CSV + xlsx</button>
  `;
}

function newRecipeTemplate() {
  return hydrateRecipe({
    id: createRecipeId('new-recipe'),
    custom: true,
    name: '',
    tag: 'Kitchen Draft',
    description: '',
    yieldPortions: 10,
    onThisWeek: false,
    soldOut: false,
    ingredients: [blankIngredient()]
  });
}

kitchenList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const recipe = getRecipes().find((item) => item.id === button.dataset.id);
  if (!recipe) return;

  if (button.dataset.action === 'week') {
    updateRecipeAvailability(recipe.id, { onThisWeek: !recipe.onThisWeek });
  }

  if (button.dataset.action === 'soldout') {
    updateRecipeAvailability(recipe.id, { soldOut: !recipe.soldOut });
  }

  renderKitchen();
  renderTripRecipePick();
});

clearSoldOutButton.addEventListener('click', () => {
  clearSoldOutFlags();
  renderKitchen();
});

ordersList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-advance]');
  if (!button) return;
  const order = getOrders().find((item) => item.id === button.dataset.advance);
  if (!order) return;
  setOrderStatus(order.id, nextStatus(order.status));
  renderOrders();
});

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((item) => item.classList.toggle('is-active', item === tab));
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab.dataset.tab;
    });
  });
});

document.getElementById('new-recipe').addEventListener('click', () => {
  fillRecipeForm(newRecipeTemplate());
  showLabStatus('Blank recipe ready. Add ingredients or ask the bot to draft.');
});

document.getElementById('export-workbook').addEventListener('click', () => {
  exportBusinessWorkbook();
  renderRecords();
  showLabStatus('Downloaded CSV files and 209-meal-prep-workbook.xlsx.');
});

document.getElementById('recipe-pick').addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-recipe]');
  if (!button) return;
  const recipe = getRecipes().find((item) => item.id === button.dataset.openRecipe);
  if (recipe) fillRecipeForm(recipe);
});

document.getElementById('add-ingredient').addEventListener('click', () => {
  const recipe = readFormRecipe();
  recipe.ingredients.push(blankIngredient());
  fillRecipeForm(recipe);
});

document.getElementById('ingredient-list').addEventListener('click', async (event) => {
  const remove = event.target.closest('[data-remove-ing]');
  if (remove) {
    const recipe = readFormRecipe();
    recipe.ingredients = recipe.ingredients.filter((item) => item.id !== remove.dataset.removeIng);
    fillRecipeForm(recipe);
    return;
  }
  const usda = event.target.closest('[data-usda]');
  if (usda) {
    usda.disabled = true;
    try {
      await applyUsdaToIngredient(usda.dataset.usda);
    } catch (error) {
      showLabStatus(error.message);
    } finally {
      usda.disabled = false;
    }
  }
});

document.getElementById('recipe-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const recipe = readFormRecipe();
  if (!recipe.name) {
    showLabStatus('Name the recipe before saving.');
    return;
  }
  const saved = upsertSavedRecipe(recipe);
  fillRecipeForm(saved);
  renderKitchen();
  renderRecords();
  renderTripRecipePick();
  showLabStatus(`Saved ${saved.name}. Input fields stayed as you typed; sourced USDA values remain on each ingredient.`);
});

document.getElementById('delete-recipe').addEventListener('click', () => {
  const id = document.getElementById('recipe-id').value;
  if (!id) return;
  deleteSavedRecipe(id);
  fillRecipeForm(getRecipes()[0] || newRecipeTemplate());
  renderKitchen();
  renderTripRecipePick();
  showLabStatus('Removed the custom copy of that recipe.');
});

document.getElementById('save-usda-key').addEventListener('click', () => {
  saveSettings({ usdaApiKey: document.getElementById('usda-key').value.trim() });
  showLabStatus('Saved the USDA key on this device only.');
});

document.getElementById('assistant-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('assistant-input');
  const message = input.value.trim();
  if (!message) return;
  appendAssistant('user', message);
  input.value = '';
  try {
    const result = await runAssistant(message);
    let extra = '';
    if (result.type === 'usda') extra = usdaResultHtml(result.foods);
    if (result.type === 'recipe') {
      fillRecipeForm(result.recipe);
      extra = '<p class="kitchen-note">Loaded into the form. Save when the costs and yields look right.</p>';
    }
    if (result.type === 'trip') {
      renderTrip(result.trip);
      extra = '<p class="kitchen-note">Open the Shopping tab to see the grouped list.</p>';
    }
    appendAssistant('bot', result.text, extra);
    renderRecords();
  } catch (error) {
    appendAssistant('bot', error.message);
  }
});

document.getElementById('assistant-log').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-apply-food]');
  if (!button) return;
  const recipe = readFormRecipe();
  const ingredient = recipe.ingredients.find((item) => !item.fdcId) || recipe.ingredients[0] || blankIngredient();
  if (!recipe.ingredients.includes(ingredient)) recipe.ingredients.push(ingredient);
  ingredient.name = button.dataset.foodName;
  ingredient.grams = ingredient.grams || 100;
  ingredient.amount = ingredient.amount || ingredient.grams;
  fillRecipeForm(recipe);
  await applyUsdaToIngredient(ingredient.id, button.dataset.foodName);
});

document.getElementById('store-form').addEventListener('submit', (event) => {
  event.preventDefault();
  addStore({
    name: document.getElementById('store-name').value,
    url: document.getElementById('store-url').value,
    searchUrlTemplate: document.getElementById('store-search').value,
    typicalItems: document.getElementById('store-typical').value,
    notes: document.getElementById('store-notes').value
  });
  event.target.reset();
  renderStores();
  renderRecords();
  if (activeRecipeId) fillRecipeForm(readFormRecipe());
});

document.getElementById('store-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-store]');
  if (!button) return;
  removeStore(button.dataset.removeStore);
  renderStores();
});

document.getElementById('plan-week-trip').addEventListener('click', () => {
  const weekly = getWeeklyMenu();
  if (!weekly.length) {
    document.getElementById('trip-result').innerHTML = '<p class="kitchen-note">No meals are on this week’s menu.</p>';
    return;
  }
  renderTrip(planShoppingTrip(weekly.map((recipe) => recipe.id), 'This week’s menu'));
  renderRecords();
});

document.getElementById('plan-selected-trip').addEventListener('click', () => {
  const ids = Array.from(document.querySelectorAll('#trip-recipe-pick input:checked')).map((input) => input.value);
  if (!ids.length) {
    document.getElementById('trip-result').innerHTML = '<p class="kitchen-note">Select at least one recipe.</p>';
    return;
  }
  renderTrip(planShoppingTrip(ids, 'Selected recipes'));
  renderRecords();
});

document.getElementById('trip-result').addEventListener('click', (event) => {
  if (!event.target.closest('#export-trip') || !lastTrip) return;
  exportTripWorkbook(lastTrip);
});

window.addEventListener('storage', () => {
  renderKitchen();
  renderOrders();
  renderRecipePick();
  renderStores();
  renderRecords();
});

document.getElementById('usda-key').value = getSettings().usdaApiKey || '';
fillRecipeForm(getRecipes()[0] || newRecipeTemplate());
appendAssistant('bot', assistantHelp());
renderKitchen();
renderOrders();
renderStores();
renderTripRecipePick();
renderRecords();
