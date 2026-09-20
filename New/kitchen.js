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

function nextStatus(status) {
  const index = STATUS_FLOW.indexOf(status);
  return STATUS_FLOW[Math.min(index + 1, STATUS_FLOW.length - 1)];
}

function renderKitchen() {
  const recipes = getRecipes();
  const onMenu = recipes.filter((recipe) => recipe.onThisWeek);
  const soldOut = onMenu.filter((recipe) => recipe.soldOut);

  kitchenSummary.textContent = `${onMenu.length} on this week's menu · ${soldOut.length} sold out`;

  kitchenList.innerHTML = recipes.map((recipe) => `
    <article class="kitchen-card ${recipe.onThisWeek ? 'is-on' : ''} ${recipe.soldOut ? 'is-sold-out' : ''}">
      <div class="kitchen-card-copy">
        <span class="card-tag">${recipe.tag}</span>
        <h2>${recipe.name}</h2>
        <p>${recipe.description}</p>
        <span class="calories">${recipe.calories} Cal | ${recipe.protein}g Protein</span>
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
    ? `<h2>Still to cook</h2>${tallyItems.map(([name, qty]) => `<span>${qty}× ${name}</span>`).join('')}`
    : '<p>No open orders.</p>';

  if (orders.length === 0) {
    ordersList.innerHTML = '<p class="menu-empty">No orders yet. They’ll land here after a customer submits checkout.</p>';
    return;
  }

  ordersList.innerHTML = orders.map((order) => `
    <article class="order-ticket status-${order.status}">
      <header>
        <strong>${order.id}</strong>
        <span class="status-pill">${STATUS_LABELS[order.status]}</span>
      </header>
      <p>${order.name} · ${order.phone}<br>${order.email}</p>
      <p>${order.orderType}${order.address ? ` · ${order.address}` : ''}</p>
      <ul>
        ${order.items.map((item) => `<li>${item.qty}× ${item.name}</li>`).join('')}
      </ul>
      <p><strong>$${order.total.toFixed(2)}</strong> · ${order.planCount} meals</p>
      ${order.notes ? `<p class="ticket-notes">${order.notes}</p>` : ''}
      ${order.status === 'complete' ? '' : `
        <button type="button" class="toggle-btn is-active" data-advance="${order.id}">
          Mark ${STATUS_LABELS[nextStatus(order.status)]}
        </button>
      `}
    </article>
  `).join('');
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

window.addEventListener('storage', () => {
  renderKitchen();
  renderOrders();
});

renderKitchen();
renderOrders();
