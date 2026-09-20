const mealSelect = document.getElementById('meal-count');
const totalPriceDisplay = document.getElementById('total-price');
const menuGrid = document.getElementById('menu-grid');
const orderPicker = document.getElementById('order-picker');
const orderCount = document.getElementById('order-count');
const orderForm = document.getElementById('order-form');
const orderType = document.getElementById('order-type');
const deliveryAddress = document.getElementById('delivery-address');
const orderRecap = document.getElementById('order-recap');
const orderError = document.getElementById('order-error');
const orderSuccess = document.getElementById('order-success');
const submitOrder = document.getElementById('submit-order');

const cart = {};

function getPlanCount() {
  return parseInt(mealSelect.value, 10);
}

function getPlanRate() {
  return PLAN_PRICES[getPlanCount()];
}

function getPlanTotal() {
  return getPlanCount() * getPlanRate();
}

function getSelectedCount() {
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}

function getSelectedItems() {
  return getAvailableOrderMeals()
    .filter((recipe) => cart[recipe.id] > 0)
    .map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      qty: cart[recipe.id]
    }));
}

function pruneCart() {
  const availableIds = new Set(getAvailableOrderMeals().map((recipe) => recipe.id));
  Object.keys(cart).forEach((id) => {
    if (!availableIds.has(id) || cart[id] <= 0) {
      delete cart[id];
    }
  });
}

function setMealQty(id, qty) {
  const nextQty = Math.max(0, qty);
  const current = cart[id] || 0;
  const otherCount = getSelectedCount() - current;
  const allowed = Math.min(nextQty, getPlanCount() - otherCount);
  if (allowed <= 0) {
    delete cart[id];
  } else {
    cart[id] = allowed;
  }
}

function updatePlanDisplay() {
  if (totalPriceDisplay) {
    totalPriceDisplay.textContent = `$${getPlanTotal().toFixed(2)}`;
  }
}

function renderMenu() {
  if (!menuGrid) return;

  const weeklyMenu = getWeeklyMenu();

  if (weeklyMenu.length === 0) {
    menuGrid.innerHTML = `
      <p class="menu-empty">This week's menu is being updated. Check back shortly or send a note with your order request.</p>
    `;
    return;
  }

  menuGrid.innerHTML = weeklyMenu.map((recipe) => `
    <article class="menu-card ${recipe.soldOut ? 'is-sold-out' : ''}">
      <div class="card-tag">${recipe.tag}</div>
      ${recipe.soldOut ? '<div class="sold-out-badge">Sold out</div>' : ''}
      <h3>${recipe.name}</h3>
      <p>${recipe.description}</p>
      <span class="calories">${recipe.calories} Cal | ${recipe.protein}g Protein</span>
      ${recipe.soldOut ? '' : `<button type="button" class="btn-add" data-add="${recipe.id}">Add to order</button>`}
    </article>
  `).join('');
}

function renderOrderPicker() {
  if (!orderPicker) return;

  pruneCart();
  const meals = getAvailableOrderMeals();
  const selected = getSelectedCount();
  const planCount = getPlanCount();

  if (meals.length === 0) {
    orderPicker.innerHTML = '<p class="menu-empty">No meals are available to order right now.</p>';
  } else {
    orderPicker.innerHTML = meals.map((recipe) => {
      const qty = cart[recipe.id] || 0;
      return `
        <div class="picker-row">
          <div>
            <strong>${recipe.name}</strong>
            <span>${recipe.tag}</span>
          </div>
          <div class="qty-controls">
            <button type="button" data-qty="${recipe.id}" data-delta="-1" aria-label="Remove one ${recipe.name}">−</button>
            <span>${qty}</span>
            <button type="button" data-qty="${recipe.id}" data-delta="1" aria-label="Add one ${recipe.name}">+</button>
          </div>
        </div>
      `;
    }).join('');
  }

  orderCount.textContent = `${selected} of ${planCount} meals selected`;
  orderCount.classList.toggle('is-complete', selected === planCount);

  const items = getSelectedItems();
  orderRecap.innerHTML = `
    <p><strong>Weekly total:</strong> $${getPlanTotal().toFixed(2)}</p>
    <p>${items.length ? items.map((item) => `${item.qty}× ${item.name}`).join('<br>') : 'Add meals to build your box.'}</p>
  `;
}

function showError(message) {
  orderError.hidden = !message;
  orderError.textContent = message || '';
}

function toggleDeliveryField() {
  if (!orderType || !deliveryAddress) return;
  const needsAddress = orderType.value === 'Local Home Delivery';
  deliveryAddress.hidden = !needsAddress;
  deliveryAddress.required = needsAddress;
}

function buildOrder() {
  const items = getSelectedItems();
  return {
    id: createOrderId(),
    createdAt: new Date().toISOString(),
    name: document.getElementById('customer-name').value.trim(),
    email: document.getElementById('customer-email').value.trim(),
    phone: document.getElementById('customer-phone').value.trim(),
    orderType: orderType.value,
    address: deliveryAddress.hidden ? '' : deliveryAddress.value.trim(),
    notes: document.getElementById('order-notes').value.trim(),
    planCount: getPlanCount(),
    rate: getPlanRate(),
    total: getPlanTotal(),
    items,
    status: 'new'
  };
}

async function submitToEmail(order) {
  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      access_key: '4af22d03-2af5-4e71-a375-25567a8f6926',
      subject: `209 Meal Prep Order ${order.id}`,
      from_name: order.name,
      email: order.email,
      'Customer Name': order.name,
      'Customer Email': order.email,
      'Customer Phone': order.phone,
      'Order Type': order.orderType,
      'Delivery Address': order.address || 'N/A',
      'Order ID': order.id,
      Plan: `${order.planCount} meals`,
      'Order Total': `$${order.total.toFixed(2)}`,
      'Meal Selections': formatOrderSummary(order),
      'Special Requests & Notes': order.notes || 'None'
    })
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'The order email could not be sent.');
  }
}

if (mealSelect && totalPriceDisplay) {
  mealSelect.addEventListener('change', () => {
    pruneCart();
    const selected = getSelectedCount();
    if (selected > getPlanCount()) {
      Object.keys(cart).forEach((id) => delete cart[id]);
    }
    updatePlanDisplay();
    renderOrderPicker();
  });
}

if (menuGrid) {
  menuGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-add]');
    if (!button) return;
    setMealQty(button.dataset.add, (cart[button.dataset.add] || 0) + 1);
    renderOrderPicker();
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
  });
}

if (orderPicker) {
  orderPicker.addEventListener('click', (event) => {
    const button = event.target.closest('[data-qty]');
    if (!button) return;
    const id = button.dataset.qty;
    const delta = parseInt(button.dataset.delta, 10);
    setMealQty(id, (cart[id] || 0) + delta);
    renderOrderPicker();
  });
}

if (orderType) {
  orderType.addEventListener('change', toggleDeliveryField);
}

if (orderForm) {
  orderForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');
    orderSuccess.hidden = true;

    if (getSelectedCount() !== getPlanCount()) {
      showError(`Select exactly ${getPlanCount()} meals before submitting.`);
      return;
    }

    if (orderType.value === 'Local Home Delivery' && !deliveryAddress.value.trim()) {
      showError('Add a delivery address.');
      return;
    }

    const order = buildOrder();
    document.getElementById('order-subject').value = `209 Meal Prep Order ${order.id}`;
    document.getElementById('field-order-id').value = order.id;
    document.getElementById('field-plan').value = `${order.planCount} meals`;
    document.getElementById('field-total').value = `$${order.total.toFixed(2)}`;
    document.getElementById('field-meals').value = formatOrderSummary(order);

    submitOrder.disabled = true;
    submitOrder.textContent = 'Sending order...';

    try {
      await submitToEmail(order);
      addOrder(order);
      orderSuccess.hidden = false;
      orderSuccess.textContent = `Order ${order.id} sent. We’ll confirm by email.`;
      Object.keys(cart).forEach((id) => delete cart[id]);
      orderForm.reset();
      mealSelect.value = '10';
      toggleDeliveryField();
      updatePlanDisplay();
      renderOrderPicker();
    } catch (error) {
      addOrder(order);
      showError(`${error.message} The order was still saved to the kitchen board on this device.`);
    } finally {
      submitOrder.disabled = false;
      submitOrder.textContent = 'Submit Order';
    }
  });
}

window.addEventListener('storage', () => {
  renderMenu();
  renderOrderPicker();
});

updatePlanDisplay();
renderMenu();
renderOrderPicker();
toggleDeliveryField();
