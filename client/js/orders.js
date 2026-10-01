/**
 * CloudBite - Order History & Status Tracking (FR-07, FR-08)
 * Access-controlled order views, customer privacy protection, safe DOM rendering, and isolated staff simulation
 */

let isAdminMode = false;
let currentLookupId = null;

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initOrdersPage();
  });
}

function initOrdersPage() {
  const adminToken = getAdminToken();
  isAdminMode = Boolean(adminToken);

  updateAdminModeBanner();

  const refreshBtn = document.getElementById('refreshOrdersBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => fetchOrders());

  const adminToggleBtn = document.getElementById('adminModeToggleBtn');
  if (adminToggleBtn) adminToggleBtn.addEventListener('click', promptAdminMode);

  const exitAdminBtn = document.getElementById('exitAdminModeBtn');
  if (exitAdminBtn) exitAdminBtn.addEventListener('click', exitAdminMode);

  const lookupBtn = document.getElementById('orderLookupBtn');
  const lookupInput = document.getElementById('orderLookupInput');
  const clearLookupBtn = document.getElementById('clearLookupBtn');

  if (lookupBtn && lookupInput) {
    lookupBtn.addEventListener('click', () => handleOrderLookup());
    lookupInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleOrderLookup();
      }
    });
  }

  if (clearLookupBtn) {
    clearLookupBtn.addEventListener('click', () => {
      currentLookupId = null;
      if (lookupInput) lookupInput.value = '';
      clearLookupBtn.style.display = 'none';
      fetchOrders();
    });
  }

  fetchOrders();
}

function updateAdminModeBanner() {
  const banner = document.getElementById('adminModeBanner');
  const toggleBtn = document.getElementById('adminModeToggleBtn');
  if (banner) {
    banner.style.display = isAdminMode ? 'flex' : 'none';
  }
  if (toggleBtn) {
    toggleBtn.textContent = isAdminMode ? '⚙️ Staff Mode Active' : '⚙️ Staff / Demo Mode';
  }
}

function promptAdminMode() {
  if (isAdminMode) {
    showToast('Staff Mode is already active', 'info');
    return;
  }

  const enteredKey = window.prompt(
    'Enter Staff / Demo Admin Key to enable full order access and status simulation:\n(Default Demo Key: admin123)'
  );

  if (enteredKey === null) return; // User cancelled

  const cleanKey = enteredKey.trim();
  if (!cleanKey) {
    showToast('Admin key cannot be empty', 'error');
    return;
  }

  setAdminToken(cleanKey);
  isAdminMode = true;
  updateAdminModeBanner();
  showToast('Staff Mode enabled: Access granted to all orders and status controls', 'success');
  fetchOrders();
}

function exitAdminMode() {
  setAdminToken('');
  isAdminMode = false;
  updateAdminModeBanner();
  showToast('Exited Staff Mode. Returned to personal customer view.', 'info');
  fetchOrders();
}

function handleOrderLookup() {
  const input = document.getElementById('orderLookupInput');
  const clearBtn = document.getElementById('clearLookupBtn');
  if (!input) return;

  const rawId = input.value.trim().toUpperCase();
  if (!rawId) {
    showToast('Please enter an Order ID to search', 'error');
    return;
  }

  currentLookupId = rawId;
  if (clearBtn) clearBtn.style.display = 'inline-block';
  fetchOrders();
}

async function fetchOrders() {
  const container = document.getElementById('ordersListContainer');
  const emptyState = document.getElementById('emptyOrdersState');
  const emptyTitle = document.getElementById('emptyTitle');
  const emptyDesc = document.getElementById('emptyDesc');
  const loader = document.getElementById('ordersLoader');

  if (!container) return;

  if (loader) loader.style.display = 'flex';
  if (emptyState) emptyState.style.display = 'none';
  container.innerHTML = '';

  const headers = {};
  const adminToken = getAdminToken();
  if (adminToken) {
    headers['x-admin-token'] = adminToken;
  }

  try {
    let url = `${API_BASE_URL}/orders`;

    // 1. If looking up a specific Order ID
    if (currentLookupId) {
      url = `${API_BASE_URL}/orders/${encodeURIComponent(currentLookupId)}`;
      const response = await fetch(url, { headers });

      if (loader) loader.style.display = 'none';

      if (response.status === 404) {
        if (emptyState) {
          if (emptyTitle) emptyTitle.textContent = `Order #${currentLookupId} not found`;
          if (emptyDesc) emptyDesc.textContent = 'Please double check the Order ID and try again.';
          emptyState.style.display = 'block';
        }
        return;
      }

      if (!response.ok) {
        throw new Error(`Server returned error status ${response.status}`);
      }

      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        renderOrdersList([resJson.data], resJson.isAdmin || isAdminMode);
      } else {
        throw new Error(resJson.message || 'Order could not be retrieved.');
      }
      return;
    }

    // 2. If Staff Mode is active, fetch all global orders
    if (isAdminMode) {
      const response = await fetch(url, { headers });
      if (loader) loader.style.display = 'none';

      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          showToast('Invalid staff key. Exiting staff mode.', 'error');
          exitAdminMode();
          return;
        }
        throw new Error(`Server error: status ${response.status}`);
      }

      const result = await response.json();
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        renderOrdersList(result.data, true);
      } else {
        if (emptyState) {
          if (emptyTitle) emptyTitle.textContent = 'No orders found';
          if (emptyDesc) emptyDesc.textContent = 'No orders have been placed in the system yet.';
          emptyState.style.display = 'block';
        }
      }
      return;
    }

    // 3. Customer Mode: Fetch only permitted personal orders
    const myOrderIds = getMyOrderIds();
    if (myOrderIds.length === 0) {
      if (loader) loader.style.display = 'none';
      if (emptyState) {
        if (emptyTitle) emptyTitle.textContent = 'No orders placed yet';
        if (emptyDesc) emptyDesc.textContent = "You haven't placed any food orders on CloudBite yet. Start exploring our delicious menus or use the lookup above if you have an Order ID!";
        emptyState.style.display = 'block';
      }
      return;
    }

    // Request only the customer's permitted order IDs
    url = `${API_BASE_URL}/orders?orderIds=${encodeURIComponent(myOrderIds.join(','))}`;
    const response = await fetch(url);
    if (loader) loader.style.display = 'none';

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const result = await response.json();
    if (result.success && Array.isArray(result.data) && result.data.length > 0) {
      renderOrdersList(result.data, false);
    } else {
      if (emptyState) {
        if (emptyTitle) emptyTitle.textContent = 'No past orders found';
        if (emptyDesc) emptyDesc.textContent = 'Your previously saved orders could not be found or have expired.';
        emptyState.style.display = 'block';
      }
    }

  } catch (error) {
    console.error('Error fetching orders:', error);
    if (loader) loader.style.display = 'none';
    renderOrdersErrorState(container, 'Unable to load orders right now. Please check your network connection and try again.');
    showToast('Failed to load orders', 'error');
  }
}

function renderOrdersErrorState(container, message) {
  container.innerHTML = '';
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';

  const icon = document.createElement('div');
  icon.className = 'empty-state-icon';
  icon.textContent = '⚠️';

  const title = document.createElement('h3');
  title.className = 'empty-state-title';
  title.textContent = 'Unable to load order history';

  const desc = document.createElement('p');
  desc.className = 'empty-state-text';
  desc.textContent = message;

  const retryBtn = document.createElement('button');
  retryBtn.className = 'btn btn-primary';
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', () => fetchOrders());

  emptyState.appendChild(icon);
  emptyState.appendChild(title);
  emptyState.appendChild(desc);
  emptyState.appendChild(retryBtn);
  container.appendChild(emptyState);
}

function getStatusClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'delivered') return 'status-completed';
  if (s === 'ready') return 'status-ready';
  if (s === 'preparing') return 'status-preparing';
  if (s === 'cancelled') return 'status-cancelled';
  return 'status-confirmed';
}

function renderOrdersList(orders, showAdminControls = false) {
  const container = document.getElementById('ordersListContainer');
  if (!container) return;

  container.innerHTML = '';
  const fragment = document.createDocumentFragment();

  orders.forEach(order => {
    const card = document.createElement('article');
    card.className = 'order-card';
    card.id = `order-card-${order.id}`;

    const rawStatus = (order.status || 'CONFIRMED').toUpperCase();
    const statusClass = getStatusClass(rawStatus);

    let dateFormatted = 'Recently placed';
    try {
      dateFormatted = order.formattedDate || (order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Recently placed');
    } catch (e) {
      dateFormatted = 'Recently placed';
    }

    // Header section
    const header = document.createElement('div');
    header.className = 'order-card-header';

    const infoDiv = document.createElement('div');

    const idBadge = document.createElement('span');
    idBadge.className = 'order-id-badge';
    idBadge.textContent = `Order #${order.id || 'N/A'}`;

    const dateDiv = document.createElement('div');
    dateDiv.className = 'order-date';
    dateDiv.textContent = `Placed on ${dateFormatted}`;

    const custDiv = document.createElement('div');
    custDiv.style.cssText = 'font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;';
    custDiv.textContent = '👤 Customer: ';
    const custStrong = document.createElement('strong');
    custStrong.textContent = String(order.customerName || 'Customer');
    custDiv.appendChild(custStrong);

    if (order.customerPhone && order.customerPhone !== 'Not provided') {
      const phoneSpan = document.createElement('span');
      phoneSpan.textContent = ` • 📞 ${order.customerPhone}`;
      custDiv.appendChild(phoneSpan);
    }

    infoDiv.appendChild(idBadge);
    infoDiv.appendChild(dateDiv);
    infoDiv.appendChild(custDiv);

    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge ${statusClass}`;
    statusBadge.textContent = `● ${rawStatus}`;

    header.appendChild(infoDiv);
    header.appendChild(statusBadge);
    card.appendChild(header);

    // Stepper section (FR-08)
    const stages = ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];
    const currentStageIndex = stages.indexOf(rawStatus);
    const isCancelled = rawStatus === 'CANCELLED';

    if (isCancelled) {
      const cancelledNotice = document.createElement('div');
      cancelledNotice.style.cssText = 'background: var(--danger-light); color: var(--danger); padding: 0.5rem 1rem; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 700; text-align: center; margin: 1rem 0;';
      cancelledNotice.textContent = '❌ Order was Cancelled';
      card.appendChild(cancelledNotice);
    } else {
      const stepper = document.createElement('div');
      stepper.className = 'order-status-stepper';
      stepper.setAttribute('role', 'group');
      stepper.setAttribute('aria-label', `Order progress: ${rawStatus}`);

      stages.forEach((stage, idx) => {
        const isCompleted = currentStageIndex > idx;
        const isCurrent = currentStageIndex === idx;

        const stepItem = document.createElement('div');
        stepItem.className = `step-item ${isCompleted ? 'active-step' : (isCurrent ? 'current-step' : '')}`;

        const circle = document.createElement('div');
        circle.className = 'step-circle';
        circle.textContent = isCompleted ? '✓' : String(idx + 1);

        const label = document.createElement('div');
        label.className = 'step-label';
        label.textContent = stage;

        stepItem.appendChild(circle);
        stepItem.appendChild(label);
        stepper.appendChild(stepItem);
      });

      card.appendChild(stepper);
    }

    // Status Simulation Controls: ONLY displayed if Staff/Admin mode is active
    if (showAdminControls) {
      const simBar = document.createElement('div');
      simBar.className = 'status-simulation-bar';

      const simLabel = document.createElement('label');
      simLabel.htmlFor = `status-select-${order.id}`;
      simLabel.textContent = '⚙️ Staff Status Transition (FR-08):';

      const controls = document.createElement('div');
      controls.className = 'status-simulation-controls';

      const select = document.createElement('select');
      select.id = `status-select-${order.id}`;
      select.className = 'status-select';
      select.setAttribute('aria-label', `Change status for order ${order.id}`);

      ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'].forEach(st => {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st;
        if (st === rawStatus) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener('change', (e) => {
        handleStatusChange(order.id, e.target.value);
      });

      controls.appendChild(select);

      if (!isCancelled && currentStageIndex < 3) {
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'btn btn-outline btn-sm';
        nextBtn.style.cssText = 'padding: 0.25rem 0.6rem; font-size: 0.75rem;';
        nextBtn.textContent = 'Next Stage ➔';
        nextBtn.setAttribute('aria-label', `Advance order ${order.id} to next stage`);
        nextBtn.addEventListener('click', () => {
          advanceNextStage(order.id, rawStatus);
        });
        controls.appendChild(nextBtn);
      }

      simBar.appendChild(simLabel);
      simBar.appendChild(controls);
      card.appendChild(simBar);
    }

    // Items table
    const table = document.createElement('table');
    table.className = 'order-items-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Item', 'Qty', 'Price', 'Subtotal'].forEach((heading, idx) => {
      const th = document.createElement('th');
      th.textContent = heading;
      if (idx === 1) th.style.textAlign = 'center';
      if (idx >= 2) th.style.textAlign = 'right';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const items = Array.isArray(order.items) ? order.items : [];

    if (items.length > 0) {
      items.forEach(item => {
        const tr = document.createElement('tr');

        const nameTd = document.createElement('td');
        const strong = document.createElement('strong');
        strong.textContent = String(item.name || 'Food Item');
        nameTd.appendChild(strong);

        const qtyTd = document.createElement('td');
        qtyTd.style.textAlign = 'center';
        qtyTd.textContent = String(item.quantity || 1);

        const priceTd = document.createElement('td');
        priceTd.style.textAlign = 'right';
        priceTd.textContent = formatPrice(item.price || 0);

        const subtotalTd = document.createElement('td');
        subtotalTd.style.textAlign = 'right';
        const subtotalVal = item.itemTotal || ((item.price || 0) * (item.quantity || 1));
        subtotalTd.textContent = formatPrice(subtotalVal);

        tr.appendChild(nameTd);
        tr.appendChild(qtyTd);
        tr.appendChild(priceTd);
        tr.appendChild(subtotalTd);
        tbody.appendChild(tr);
      });
    } else {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.style.textAlign = 'center';
      td.style.color = 'var(--text-muted)';
      td.textContent = 'No item details recorded';
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    card.appendChild(table);

    // Footer section
    const footer = document.createElement('div');
    footer.className = 'order-card-footer';

    const countSpan = document.createElement('span');
    countSpan.style.cssText = 'font-weight: 600; color: var(--text-muted); font-size: 0.9rem;';
    countSpan.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;

    const totalDiv = document.createElement('div');
    totalDiv.style.textAlign = 'right';

    const totalLabel = document.createElement('span');
    totalLabel.style.cssText = 'font-size: 0.85rem; color: var(--text-muted); margin-right: 0.5rem;';
    totalLabel.textContent = 'Total Paid:';

    const totalPrice = document.createElement('span');
    totalPrice.className = 'order-total-price';
    totalPrice.textContent = formatPrice(order.totalAmount || 0);

    totalDiv.appendChild(totalLabel);
    totalDiv.appendChild(totalPrice);

    footer.appendChild(countSpan);
    footer.appendChild(totalDiv);
    card.appendChild(footer);

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

// Interactive Status Transition Simulation (Admin Protected)
async function handleStatusChange(orderId, newStatus) {
  const adminToken = getAdminToken();
  if (!adminToken) {
    showToast('Admin authorization required to change order status', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken
      },
      body: JSON.stringify({ status: newStatus })
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to update status');
    }

    showToast(`Order #${orderId} status updated to ${newStatus}`, 'success');
    fetchOrders();
  } catch (error) {
    console.error('Error updating status:', error);
    showToast(error.message || 'Failed to update order status', 'error');
  }
}

function advanceNextStage(orderId, currentStatus) {
  const stages = ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];
  const currentIndex = stages.indexOf(currentStatus.toUpperCase());
  if (currentIndex > -1 && currentIndex < stages.length - 1) {
    const nextStatus = stages[currentIndex + 1];
    handleStatusChange(orderId, nextStatus);
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getStatusClass
  };
}
