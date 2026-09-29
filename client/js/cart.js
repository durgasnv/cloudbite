/**
 * CloudBite - Cart & Checkout Logic (FR-04, FR-05, FR-06, FR-07)
 */

document.addEventListener('DOMContentLoaded', () => {
  renderCart();

  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', handlePlaceOrder);
  }
});

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

  // Render items list (FR-05 & FR-06)
  cartContainer.innerHTML = cart.map(item => `
    <div class="cart-item-row" data-id="${item.id}">
      <div class="cart-item-info">
        <img 
          src="${item.image}" 
          alt="${item.name}" 
          class="cart-item-img"
          onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&q=80'"
        />
        <div>
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-unit-price">${formatPrice(item.price)} each</div>
        </div>
      </div>

      <div class="quantity-controls">
        <button class="qty-btn" onclick="handleQtyChange(${item.id}, -1)">−</button>
        <span class="qty-count">${item.quantity}</span>
        <button class="qty-btn" onclick="handleQtyChange(${item.id}, 1)">+</button>
      </div>

      <div class="cart-item-total">
        ${formatPrice(item.price * item.quantity)}
      </div>

      <button class="remove-item-btn" onclick="handleRemoveItem(${item.id})" title="Remove item">
        🗑️
      </button>
    </div>
  `).join('');

  // Calculate & render summary (FR-06)
  const subtotal = getCartTotal();
  const deliveryFee = subtotal >= 500 || subtotal === 0 ? 0 : 40;
  const platformFee = subtotal > 0 ? 10 : 0;
  const grandTotal = subtotal + deliveryFee + platformFee;

  document.getElementById('summarySubtotal').textContent = formatPrice(subtotal);
  document.getElementById('summaryDelivery').textContent = deliveryFee === 0 ? 'FREE' : formatPrice(deliveryFee);
  document.getElementById('summaryPlatform').textContent = formatPrice(platformFee);
  document.getElementById('summaryTotal').textContent = formatPrice(grandTotal);
}

// Global Quantity Handlers (FR-05)
window.handleQtyChange = function(itemId, change) {
  updateCartItemQuantity(itemId, change);
  renderCart();
};

window.handleRemoveItem = function(itemId) {
  removeFromCart(itemId);
  renderCart();
};

// Handle Simulated Checkout Submission (POST /api/orders - FR-07)
async function handlePlaceOrder(e) {
  e.preventDefault();

  const cart = getCart();
  if (cart.length === 0) {
    showToast('Your cart is empty!', 'error');
    return;
  }

  const customerName = document.getElementById('customerName').value.trim();
  const customerPhone = document.getElementById('customerPhone').value.trim();
  const customerAddress = document.getElementById('customerAddress').value.trim();
  const submitBtn = document.getElementById('placeOrderBtn');

  if (!customerName) {
    showToast('Please enter your name.', 'error');
    return;
  }

  const subtotal = getCartTotal();
  const deliveryFee = subtotal >= 500 ? 0 : 40;
  const platformFee = 10;
  const totalAmount = subtotal + deliveryFee + platformFee;

  // Prepare payload
  const orderPayload = {
    customerName,
    customerPhone: customerPhone || 'Not specified',
    customerAddress: customerAddress || 'Standard Delivery',
    items: cart.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    })),
    totalAmount
  };

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Placing Order... ⏳';

    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to place order.');
    }

    // Success! Clear cart and display confirmation modal (FR-07)
    clearCart();
    showOrderSuccessModal(result.data);

  } catch (error) {
    console.error('Error placing order:', error);
    showToast(error.message || 'Could not place order', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Place Order →';
  }
}

function showOrderSuccessModal(order) {
  const modal = document.getElementById('orderSuccessModal');
  const orderIdSpan = document.getElementById('modalOrderId');
  const orderStatusSpan = document.getElementById('modalOrderStatus');
  const orderTotalSpan = document.getElementById('modalOrderTotal');

  if (orderIdSpan) orderIdSpan.textContent = order.id || 'ORD1025';
  if (orderStatusSpan) {
    orderStatusSpan.textContent = `● ${order.status || 'CONFIRMED'}`;
    orderStatusSpan.className = `status-badge status-${(order.status || 'confirmed').toLowerCase()}`;
  }
  if (orderTotalSpan) orderTotalSpan.textContent = formatPrice(order.totalAmount);

  if (modal) {
    modal.classList.add('active');
  } else {
    alert(`Order placed successfully!\nOrder ID: ${order.id}\nStatus: ${order.status || 'CONFIRMED'}`);
    window.location.href = 'orders.html';
  }
}
