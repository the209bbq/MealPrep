const ORDERS_KEY = '209-meal-prep-orders';

function createOrderId() {
  const now = new Date();
  const stamp = [
    now.getFullYear().toString().slice(-2),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
  return `209-${stamp}`;
}

function getOrders() {
  try {
    const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    return Array.isArray(orders) ? orders : [];
  } catch (error) {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function addOrder(order) {
  const orders = getOrders();
  orders.unshift(order);
  saveOrders(orders);
  return order;
}

function setOrderStatus(id, status) {
  const orders = getOrders().map((order) => (
    order.id === id ? { ...order, status } : order
  ));
  saveOrders(orders);
}

function getOpenPrepTally() {
  const tally = {};
  getOrders()
    .filter((order) => order.status !== 'complete')
    .forEach((order) => {
      order.items.forEach((item) => {
        tally[item.name] = (tally[item.name] || 0) + item.qty;
      });
    });
  return tally;
}

function formatOrderSummary(order) {
  const lines = [
    `Order ID: ${order.id}`,
    `Plan: ${order.planCount} meals @ $${order.rate.toFixed(2)}`,
    `Total: $${order.total.toFixed(2)}`,
    `Fulfillment: ${order.orderType}`,
    order.address ? `Address: ${order.address}` : null,
    '',
    'Meals:'
  ].filter(Boolean);

  order.items.forEach((item) => {
    lines.push(`- ${item.qty}x ${item.name}`);
  });

  if (order.notes) {
    lines.push('', `Notes: ${order.notes}`);
  }

  return lines.join('\n');
}

function getAvailableOrderMeals() {
  return getWeeklyMenu().filter((recipe) => !recipe.soldOut);
}
