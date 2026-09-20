(function initShoppingBoard() {
  const storeForm = document.getElementById('store-form');
  const storeList = document.getElementById('store-list');
  const tripResult = document.getElementById('trip-result');
  const tripHistory = document.getElementById('trip-history');
  const tripLabel = document.getElementById('trip-label');
  if (!storeForm || !storeList || !tripResult) return;

  let activeTripId = window.lastTrip && window.lastTrip.id;

  function shoppingEscape(value) {
    return typeof escapeHtml === 'function' ? escapeHtml(value) : String(value == null ? '' : value);
  }

  function money(value) {
    return typeof formatMoney === 'function' ? formatMoney(value) : `$${Number(value || 0).toFixed(2)}`;
  }

  function storeFields() {
    return {
      name: document.getElementById('store-name').value,
      url: document.getElementById('store-url').value,
      searchUrlTemplate: document.getElementById('store-search').value,
      typicalItems: document.getElementById('store-typical').value,
      notes: document.getElementById('store-notes').value
    };
  }

  function fillStoreForm(store) {
    document.getElementById('store-id').value = store ? store.id : '';
    document.getElementById('store-name').value = store ? store.name : '';
    document.getElementById('store-url').value = store ? store.url : '';
    document.getElementById('store-search').value = store ? store.searchUrlTemplate : '';
    document.getElementById('store-typical').value = store ? (store.typicalItems || []).join(', ') : '';
    document.getElementById('store-notes').value = store ? store.notes : '';
    document.getElementById('store-submit').textContent = store ? 'Update store' : 'Save store';
    document.getElementById('store-cancel-edit').hidden = !store;
  }

  window.renderStores = function renderStores() {
    const stores = getStores();
    storeList.innerHTML = stores.length ? stores.map((store) => `
      <article class="store-card">
        <h3>${shoppingEscape(store.name)}</h3>
        <p><a href="${shoppingEscape(store.url)}" target="_blank" rel="noopener">${shoppingEscape(store.url)}</a></p>
        <p class="kitchen-note">${shoppingEscape((store.typicalItems || []).join(', ') || 'No typical-item keywords yet')}</p>
        ${store.notes ? `<p class="kitchen-note">${shoppingEscape(store.notes)}</p>` : ''}
        <div class="lab-toolbar">
          <button type="button" class="btn-secondary" data-edit-store="${store.id}">Edit</button>
          <button type="button" class="btn-secondary" data-remove-store="${store.id}">Remove</button>
        </div>
      </article>
    `).join('') : '<p class="kitchen-note">No stores yet. Add the websites you shop from.</p>';
  };

  window.renderTripHistory = function renderTripHistory() {
    if (!tripHistory) return;
    const trips = getTrips();
    if (!trips.length) {
      tripHistory.innerHTML = '<p class="kitchen-note">Saved trips stay on this kitchen device. Plan one below.</p>';
      return;
    }
    tripHistory.innerHTML = trips.map((trip) => {
      const items = (trip.groups || []).flatMap((group) => group.items || []);
      const remaining = items.filter((item) => !item.checked).length;
      return `
        <article class="trip-history-card ${trip.id === activeTripId ? 'is-active' : ''}">
          <div>
            <strong>${shoppingEscape(trip.label)}</strong>
            <p class="kitchen-note">${new Date(trip.createdAt).toLocaleString()} · ${items.length} items · ${remaining} still to buy</p>
          </div>
          <div class="lab-toolbar">
            <button type="button" class="btn-secondary" data-open-trip="${trip.id}">Open</button>
            <button type="button" class="btn-secondary" data-delete-trip="${trip.id}">Delete</button>
          </div>
        </article>
      `;
    }).join('');
  };

  window.renderTrip = function renderTrip(trip) {
    window.lastTrip = trip || null;
    activeTripId = trip ? trip.id : '';
    if (!trip) {
      tripResult.innerHTML = '';
      renderTripHistory();
      return;
    }
    const stores = getStores();
    const itemCount = (trip.groups || []).reduce((sum, group) => sum + group.items.length, 0);
    const remaining = (trip.groups || []).reduce(
      (sum, group) => sum + group.items.filter((item) => !item.checked).length,
      0
    );
    tripResult.innerHTML = `
      <div class="trip-result-head">
        <h3>${shoppingEscape(trip.label)}</h3>
        <p class="kitchen-note">${itemCount} ingredients · ${remaining} still to buy · grouped by saved store sites</p>
      </div>
      ${(trip.groups || []).map((group) => `
        <article class="trip-group">
          <header>
            <strong>${shoppingEscape(group.storeName)}</strong>
            ${group.storeUrl ? `<a href="${shoppingEscape(group.storeUrl)}" target="_blank" rel="noopener">Open site</a>` : ''}
          </header>
          <ul class="trip-item-list">
            ${group.items.map((item) => `
              <li class="trip-item ${item.checked ? 'is-checked' : ''}" data-trip-item="${shoppingEscape(item.id)}">
                <label class="trip-check">
                  <input type="checkbox" data-check-item="${shoppingEscape(item.id)}" ${item.checked ? 'checked' : ''} />
                  <span>
                    ${shoppingEscape(item.name)}
                    ${item.amount || item.unit ? ` · ${shoppingEscape(item.amount || '')} ${shoppingEscape(item.unit || '')}` : ''}
                    ${item.grams ? ` · ${item.grams}g` : ''}
                    ${item.cost ? ` · ${money(item.cost)}` : ''}
                  </span>
                </label>
                <span class="kitchen-note">for ${shoppingEscape(item.recipeName)}</span>
                <label class="trip-assign">Shop at
                  <select data-assign-item="${shoppingEscape(item.id)}">
                    <option value="">Unassigned</option>
                    ${stores.map((store) => `
                      <option value="${store.id}" ${store.id === item.storeId ? 'selected' : ''}>${shoppingEscape(store.name)}</option>
                    `).join('')}
                  </select>
                </label>
                ${item.searchUrl ? `<a href="${shoppingEscape(item.searchUrl)}" target="_blank" rel="noopener">Search</a>` : ''}
              </li>
            `).join('')}
          </ul>
        </article>
      `).join('') || '<p class="kitchen-note">No ingredient lines yet. Add them in Recipe lab or shop from this week’s menu copy.</p>'}
      <div class="lab-toolbar">
        <button type="button" class="btn-secondary" id="export-trip">Export this trip CSV + xlsx</button>
      </div>
    `;
    renderTripHistory();
    if (typeof renderRecords === 'function') renderRecords();
  };

  storeForm.addEventListener('submit', (event) => {
    const editingId = document.getElementById('store-id').value;
    if (!editingId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    updateStore(editingId, storeFields());
    fillStoreForm(null);
    renderStores();
    if (activeTripId) renderTrip(getTrip(activeTripId));
    if (typeof renderRecords === 'function') renderRecords();
    if (typeof activeRecipeId !== 'undefined' && activeRecipeId && typeof fillRecipeForm === 'function') {
      fillRecipeForm(readFormRecipe());
    }
  }, true);

  document.getElementById('store-cancel-edit').addEventListener('click', () => fillStoreForm(null));

  storeList.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-store]');
    if (!edit) return;
    const store = getStores().find((item) => item.id === edit.dataset.editStore);
    if (store) fillStoreForm(store);
  });

  if (tripHistory) {
    tripHistory.addEventListener('click', (event) => {
      const open = event.target.closest('[data-open-trip]');
      if (open) {
        renderTrip(getTrip(open.dataset.openTrip));
        return;
      }
      const remove = event.target.closest('[data-delete-trip]');
      if (!remove) return;
      removeTrip(remove.dataset.deleteTrip);
      if (activeTripId === remove.dataset.deleteTrip) renderTrip(getTrips()[0] || null);
      else renderTripHistory();
    });
  }

  tripResult.addEventListener('change', (event) => {
    if (!activeTripId) return;
    const check = event.target.closest('[data-check-item]');
    if (check) {
      renderTrip(setTripItemChecked(activeTripId, check.dataset.checkItem, check.checked));
      return;
    }
    const assign = event.target.closest('[data-assign-item]');
    if (assign) {
      renderTrip(assignTripItemStore(activeTripId, assign.dataset.assignItem, assign.value));
    }
  });

  tripResult.addEventListener('click', (event) => {
    if (!event.target.closest('#export-trip')) return;
    const trip = getTrip(activeTripId) || window.lastTrip;
    if (!trip) return;
    event.stopImmediatePropagation();
    exportShoppingTrip(trip);
  }, true);

  document.getElementById('plan-week-trip').addEventListener('click', (event) => {
    event.stopImmediatePropagation();
    const weekly = typeof getWeeklyMenu === 'function' ? getWeeklyMenu() : [];
    if (!weekly.length) {
      tripResult.innerHTML = '<p class="kitchen-note">No meals are on this week’s menu.</p>';
      return;
    }
    const label = (tripLabel && tripLabel.value.trim()) || 'This week’s menu';
    renderTrip(planShoppingTrip(weekly.map((recipe) => recipe.id), label));
  }, true);

  document.getElementById('plan-selected-trip').addEventListener('click', (event) => {
    event.stopImmediatePropagation();
    const ids = Array.from(document.querySelectorAll('#trip-recipe-pick input:checked')).map((input) => input.value);
    if (!ids.length) {
      tripResult.innerHTML = '<p class="kitchen-note">Select at least one recipe.</p>';
      return;
    }
    const label = (tripLabel && tripLabel.value.trim()) || 'Selected recipes';
    renderTrip(planShoppingTrip(ids, label));
  }, true);

  function showShoppingTab() {
    const tab = document.querySelector('.kitchen-tab[data-tab="shopping"]');
    if (tab) tab.click();
  }

  if (location.hash === '#shopping') showShoppingTab();
  window.addEventListener('hashchange', () => {
    if (location.hash === '#shopping') showShoppingTab();
  });

  const latest = getTrips()[0];
  renderStores();
  if (latest) renderTrip(latest);
  else renderTripHistory();
})();
