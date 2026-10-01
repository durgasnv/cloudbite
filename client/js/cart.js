/**
 * CloudBite - Cart & Checkout Logic (FR-04, FR-05, FR-06, FR-07)
 * Safe DOM rendering, authoritative checkout verification, error recovery without cart loss, and accessible dialogs
 */

let lastActiveElement = null;

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    renderCart();

    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', handlePlaceOrder);
    }

    // Modal accessibility: Escape key listener
    window.addEventListener('keydown', (e) => {
      const modal = document.getElementById('orderSuccessModal');
      if (modal && modal.classList.contains('active') && e.key === 'Escape') {
        closeSuccessModal();
      }
    });
  });
}

function calculateOrderTotals(cart) {
  const subtotal = (cart || []).reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  const deliveryFee = (subtotal >= 500 || subtotal === 0) ? 0 : 40;
  const platformFee = subtotal > 0 ? 10 : 0;
  const grandTotal = subtotal + deliveryFee + platformFee;

  return { subtotal, deliveryFee, platformFee, grandTotal };
}

function renderCart() {
  const cart = getCart();
  const cartContainer = document.getElementById('cartItemsContainer');
  const cartLayout = document.getElementById('cartLayout');
  const emptyCartState = document.getElementById('emptyCartState');
  const itemCountLabel = document.getElementById('cartItemCountLabel');

  if (!cartContainer) return;

  if (cart.length === 0) {
    if (cartLayout) cartLayout.style.display = 'none';
    if (emptyCartState) emptyCartState.style.display = 'block';
    return;
  }

  if (cartLayout) cartLayout.style.display = 'grid';
  if (emptyCartState) emptyCartState.style.display = 'none';

  if (itemCountLabel) {
    const totalCount = getCartCount();
    itemCountLabel.textContent = `(${totalCount} ${totalCount === 1 ? 'item' : 'items'})`;
  }

  cartContainer.innerHTML = '';
  const fragment = document.createDocumentFragment();
  const fallbackImg = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&q=80';

  cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item-row';
    row.setAttribute('data-id', String(item.id));

    // Info section
    const info = document.createElement('div');
    info.className = 'cart-item-info';

    const img = document.createElement('img');
    img.src = sanitizeImageUrl(item.image, fallbackImg);
    img.alt = String(item.name || 'Food Item');
    img.className = 'cart-item-img';
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      img.src = fallbackImg;
    });

    const titleGroup = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'cart-item-title';
    title.textContent = String(item.name || 'Food Item');

    const unitPrice = document.createElement('div');
    unitPrice.className = 'cart-item-unit-price';
    unitPrice.textContent = `${formatPrice(item.price)} each`;

    titleGroup.appendChild(title);
    titleGroup.appendChild(unitPrice);
    info.appendChild(img);
    info.appendChild(titleGroup);

    // Quantity controls
    const qtyControls = document.createElement('div');
    qtyControls.className = 'quantity-controls';

    const minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.className = 'qty-btn';
    minusBtn.textContent = '−';
    minusBtn.setAttribute('aria-label', `Decrease quantity of ${item.name}`);
    minusBtn.addEventListener('click', () => handleQtyChange(item.id, -1));

    const qtySpan = document.createElement('span');
    qtySpan.className = 'qty-count';
    qtySpan.textContent = String(item.quantity);
    qtySpan.setAttribute('aria-live', 'polite');

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.className = 'qty-btn';
    plusBtn.textContent = '+';
    plusBtn.setAttribute('aria-label', `Increase quantity of ${item.name}`);
    plusBtn.addEventListener('click', () => handleQtyChange(item.id, 1));

    qtyControls.appendChild(minusBtn);
    qtyControls.appendChild(qtySpan);
    qtyControls.appendChild(plusBtn);

    // Total for this item
    const totalDiv = document.createElement('div');
    totalDiv.className = 'cart-item-total';
    totalDiv.textContent = formatPrice(Number(item.price) * Number(item.quantity));

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-item-btn';
    removeBtn.textContent = '🗑️';
    removeBtn.title = 'Remove item';
    removeBtn.setAttribute('aria-label', `Remove ${item.name} from cart`);
    removeBtn.addEventListener('click', () => handleRemoveItem(item.id));

    row.appendChild(info);
    row.appendChild(qtyControls);
    row.appendChild(totalDiv);
    row.appendChild(removeBtn);
    fragment.appendChild(row);
  });

  cartContainer.appendChild(fragment);

  // Calculate & render summary (authoritative client-side preview)
  const totals = calculateOrderTotals(cart);
  const subtotalEl = document.getElementById('summarySubtotal');
  const deliveryEl = document.getElementById('summaryDelivery');
  const platformEl = document.getElementById('summaryPlatform');
  const totalEl = document.getElementById('summaryTotal');

  if (subtotalEl) subtotalEl.textContent = formatPrice(totals.subtotal);
  if (deliveryEl) deliveryEl.textContent = totals.deliveryFee === 0 ? 'FREE' : formatPrice(totals.deliveryFee);
  if (platformEl) platformEl.textContent = formatPrice(totals.platformFee);
  if (totalEl) totalEl.textContent = formatPrice(totals.grandTotal);
}

function handleQtyChange(itemId, change) {
  updateCartItemQuantity(itemId, change);
  renderCart();
}

function handleRemoveItem(itemId) {
  removeFromCart(itemId);
  renderCart();
}

// Clear or show checkout error notice
function showCheckoutError(message, showRefreshAction = false) {
  const errContainer = document.getElementById('checkoutErrorContainer');
  if (!errContainer) return;

  errContainer.innerHTML = '';
  errContainer.style.display = 'block';

  const msgP = document.createElement('p');
  msgP.style.margin = '0 0 0.5rem 0';
  msgP.textContent = String(message || 'An error occurred during checkout.');
  errContainer.appendChild(msgP);

  if (showRefreshAction) {
    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'btn btn-outline btn-sm';
    refreshBtn.style.cssText = 'background: white; border-color: #f87171; color: #991b1b; padding: 0.25rem 0.6rem; font-size: 0.8rem;';
    refreshBtn.textContent = '🔄 Review & Refresh Cart Prices';
    refreshBtn.addEventListener('click', async () => {
      await refreshCartPrices();
      errContainer.style.display = 'none';
    });
    errContainer.appendChild(refreshBtn);
  }
}

function clearCheckoutError() {
  const errContainer = document.getElementById('checkoutErrorContainer');
  if (errContainer) {
    errContainer.style.display = 'none';
    errContainer.innerHTML = '';
  }
}

// Refresh cart prices from backend menu without losing user selection
async function refreshCartPrices() {
  try {
    const res = await fetch(`${API_BASE_URL}/menu`);
    if (!res.ok) throw new Error('Could not fetch current menu.');
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) throw new Error('Invalid menu data.');

    const currentMenu = json.data;
    const cart = getCart();
    let updatedCount = 0;
    let removedCount = 0;

    const updatedCart = [];
    for (const item of cart) {
      const liveItem = currentMenu.find(m => Number(m.id) === Number(item.id));
      if (!liveItem || liveItem.isAvailable === false) {
        removedCount += 1;
        continue;
      }
      if (Number(liveItem.price) !== Number(item.price)) {
        updatedCount += 1;
      }
      updatedCart.push({
        ...item,
        name: liveItem.name,
        price: Number(liveItem.price),
        image: liveItem.image || item.image
      });
    }

    saveCart(updatedCart);
    renderCart();

    if (removedCount > 0) {
      showToast(`${removedCount} unavailable item(s) removed from cart.`, 'info');
    }
    if (updatedCount > 0) {
      showToast(`${updatedCount} item price(s) refreshed to current menu rates.`, 'success');
    } else if (removedCount === 0) {
      showToast('Cart prices are up to date.', 'info');
    }
  } catch (err) {
    console.error('Error refreshing cart:', err);
    showToast('Failed to refresh menu prices', 'error');
  }
}

// Handle Checkout Submission (POST /api/orders - FR-07)
async function handlePlaceOrder(e) {
  e.preventDefault();
  clearCheckoutError();

  const cart = getCart();
  if (cart.length === 0) {
    showToast('Your cart is empty! Add items before placing an order.', 'error');
    return;
  }

  const nameInput = document.getElementById('customerName');
  const phoneInput = document.getElementById('customerPhone');
  const addressInput = document.getElementById('customerAddress');
  const submitBtn = document.getElementById('placeOrderBtn');

  const customerName = nameInput ? nameInput.value.trim() : '';
  const customerPhone = phoneInput ? phoneInput.value.trim() : '';
  const customerAddress = addressInput ? addressInput.value.trim() : '';

  if (!customerName) {
    showToast('Please enter your full name.', 'error');
    if (nameInput) nameInput.focus();
    return;
  }

  const totals = calculateOrderTotals(cart);

  // Send item IDs and quantities, allowing server to verify authoritative prices
  const orderPayload = {
    customerName,
    customerPhone: customerPhone || 'Not specified',
    customerAddress: customerAddress || 'Standard Delivery',
    items: cart.map(item => ({
      id: Number(item.id),
      name: item.name,
      quantity: Number(item.quantity),
      price: Number(item.price)
    })),
    totalAmount: totals.grandTotal
  };

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Placing Order... ⏳';
    }

    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      // Order was rejected or price changed - DO NOT clear cart!
      const isPriceOrItemIssue = result.priceChanged || result.unavailableItemId;
      showCheckoutError(result.message || 'Failed to place order.', isPriceOrItemIssue);
      showToast(result.message || 'Order could not be confirmed.', 'error');
      return;
    }

    // Success! Save customer's order ID in personal history, then clear cart
    if (result.data && result.data.id) {
      saveMyOrderId(result.data.id);
    }
    clearCart();

    // Show confirmation modal displaying server-authoritative order details
    showOrderSuccessModal(result.data);

  } catch (error) {
    console.error('Error placing order:', error);
    showCheckoutError('Unable to connect to order service. Please check your connection and try again.', false);
    showToast('Connection error while placing order', 'error');
  } finally {
    // Re-enable submit button in all cases so the customer is never trapped
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Place Order →';
    }
  }
}

function showOrderSuccessModal(order) {
  lastActiveElement = document.activeElement;
  const modal = document.getElementById('orderSuccessModal');
  const orderIdSpan = document.getElementById('modalOrderId');
  const orderStatusSpan = document.getElementById('modalOrderStatus');
  const orderTotalSpan = document.getElementById('modalOrderTotal');

  if (orderIdSpan) orderIdSpan.textContent = order.id || 'N/A';
  if (orderStatusSpan) {
    orderStatusSpan.textContent = `● ${order.status || 'CONFIRMED'}`;
    orderStatusSpan.className = `status-badge status-${(order.status || 'confirmed').toLowerCase()}`;
  }
  // Authoritative server-confirmed total
  if (orderTotalSpan) {
    orderTotalSpan.textContent = formatPrice(order.totalAmount);
  }

  if (modal) {
    modal.classList.add('active');
    modal.focus();
    const primaryAction = modal.querySelector('a.btn-primary');
    if (primaryAction) primaryAction.focus();
  } else {
    alert(`Order placed successfully!\nOrder ID: ${order.id}\nServer-Confirmed Total: ${formatPrice(order.totalAmount)}`);
    window.location.href = 'orders.html';
  }
}

function closeSuccessModal() {
  const modal = document.getElementById('orderSuccessModal');
  if (modal) {
    modal.classList.remove('active');
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
  }
}

// Export for Node unit testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateOrderTotals
  };
}
