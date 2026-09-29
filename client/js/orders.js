/**
 * CloudBite - Order History & Simulated Status Tracking (FR-07, FR-08)
 */

document.addEventListener('DOMContentLoaded', () => {
  fetchOrders();
});

async function fetchOrders() {
  const container = document.getElementById('ordersListContainer');
  const emptyState = document.getElementById('emptyOrdersState');
  const loader = document.getElementById('ordersLoader');

  if (!container) return;

  if (loader) loader.style.display = 'flex';
  if (emptyState) emptyState.style.display = 'none';

  try {
    const response = await fetch(`${API_BASE_URL}/orders`);
    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const result = await response.json();

    if (loader) loader.style.display = 'none';

    if (result.success && Array.isArray(result.data) && result.data.length > 0) {
      renderOrdersList(result.data);
    } else {
      if (emptyState) emptyState.style.display = 'block';
      container.innerHTML = '';
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
    if (loader) loader.style.display = 'none';
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3 class="empty-state-title">Unable to load order history</h3>
        <p class="empty-state-text">Please ensure the backend server is running on port 5000.</p>
        <button class="btn btn-primary" onclick="fetchOrders()">Retry</button>
      </div>
    `;
    showToast('Failed to load orders', 'error');
  }
}

function renderOrdersList(orders) {
  const container = document.getElementById('ordersListContainer');
  if (!container) return;

  container.innerHTML = orders.map(order => {
    const rawStatus = (order.status || 'CONFIRMED').toUpperCase();
    const statusClass = getStatusClass(rawStatus);
    let dateFormatted = 'Recently placed';
    try {
      dateFormatted = order.formattedDate || (order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Recently placed');
    } catch (e) {
      dateFormatted = 'Recently placed';
    }

    const items = Array.isArray(order.items) ? order.items : [];
    const customerPhone = order.customerPhone && order.customerPhone !== 'Not provided' 
      ? `• 📞 ${order.customerPhone}` 
      : '';

    // Stages for Stepper: CONFIRMED -> PREPARING -> READY -> COMPLETED (FR-08)
    const stages = ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];
    const currentStageIndex = stages.indexOf(rawStatus);
    const isCancelled = rawStatus === 'CANCELLED';

    const stepperHtml = isCancelled 
      ? `<div style="background: var(--danger-light); color: var(--danger); padding: 0.5rem 1rem; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 700; text-align: center; margin: 1rem 0;">
           ❌ Order was Cancelled
         </div>`
      : `
        <div class="order-status-stepper">
          ${stages.map((stage, idx) => {
            const isCompleted = currentStageIndex > idx;
            const isCurrent = currentStageIndex === idx;
            const itemClass = isCompleted ? 'active-step' : (isCurrent ? 'current-step' : '');
            return `
              <div class="step-item ${itemClass}">
                <div class="step-circle">${isCompleted ? '✓' : (idx + 1)}</div>
                <div class="step-label">${stage}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;

    return `
      <article class="order-card" id="order-card-${order.id}">
        <div class="order-card-header">
          <div>
            <span class="order-id-badge">Order #${order.id || 'N/A'}</span>
            <div class="order-date">Placed on ${dateFormatted}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">
              👤 Customer: <strong>${order.customerName || 'Anonymous'}</strong> 
              ${customerPhone}
            </div>
          </div>
          <span class="status-badge ${statusClass}">
            ● ${rawStatus}
          </span>
        </div>

        <!-- FR-08: Visual Status Progress Stepper -->
        ${stepperHtml}

        <!-- FR-08: Simulated Status Controller -->
        <div class="status-simulation-bar">
          <label for="status-select-${order.id}">
            ⚙️ <span>Simulate Order Status (FR-08):</span>
          </label>
          <div class="status-simulation-controls">
            <select id="status-select-${order.id}" class="status-select" onchange="handleStatusChange('${order.id}', this.value)">
              <option value="CONFIRMED" ${rawStatus === 'CONFIRMED' ? 'selected' : ''}>CONFIRMED</option>
              <option value="PREPARING" ${rawStatus === 'PREPARING' ? 'selected' : ''}>PREPARING</option>
              <option value="READY" ${rawStatus === 'READY' ? 'selected' : ''}>READY</option>
              <option value="COMPLETED" ${rawStatus === 'COMPLETED' ? 'selected' : ''}>COMPLETED</option>
              <option value="CANCELLED" ${rawStatus === 'CANCELLED' ? 'selected' : ''}>CANCELLED</option>
            </select>
            ${!isCancelled && currentStageIndex < 3 ? `
              <button class="btn btn-outline btn-sm" onclick="advanceNextStage('${order.id}', '${rawStatus}')" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
                Next Stage ➔
              </button>
            ` : ''}
          </div>
        </div>

        <table class="order-items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Price</th>
              <th style="text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${items.length > 0 ? items.map(item => `
              <tr>
                <td><strong>${item.name || 'Food Item'}</strong></td>
                <td style="text-align: center;">${item.quantity || 1}</td>
                <td style="text-align: right;">${formatPrice(item.price || 0)}</td>
                <td style="text-align: right;">${formatPrice((item.price || 0) * (item.quantity || 1))}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="4" style="text-align: center; color: var(--text-muted);">No items recorded</td>
              </tr>
            `}
          </tbody>
        </table>

        <div class="order-card-footer">
          <span style="font-weight: 600; color: var(--text-muted); font-size: 0.9rem;">
            ${items.length} ${items.length === 1 ? 'item' : 'items'}
          </span>
          <div style="text-align: right;">
            <span style="font-size: 0.85rem; color: var(--text-muted); margin-right: 0.5rem;">Total Paid:</span>
            <span class="order-total-price">${formatPrice(order.totalAmount || 0)}</span>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function getStatusClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'delivered') return 'status-completed';
  if (s === 'ready') return 'status-ready';
  if (s === 'preparing') return 'status-preparing';
  if (s === 'cancelled') return 'status-cancelled';
  return 'status-confirmed';
}

// FR-08: Interactive Status Transition Simulation
window.handleStatusChange = async function(orderId, newStatus) {
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to update status');
    }

    showToast(`Order #${orderId} status changed to ${newStatus}`, 'success');
    fetchOrders(); // Re-render orders
  } catch (error) {
    console.error('Error updating order status:', error);
    showToast(error.message || 'Error updating status', 'error');
  }
};

window.advanceNextStage = function(orderId, currentStatus) {
  const stages = ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];
  const currentIndex = stages.indexOf(currentStatus.toUpperCase());
  if (currentIndex > -1 && currentIndex < stages.length - 1) {
    const nextStatus = stages[currentIndex + 1];
    window.handleStatusChange(orderId, nextStatus);
  }
};
