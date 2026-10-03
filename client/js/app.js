/**
 * CloudBite - Shared Application Utilities, Cart Management & Accessibility
 */

// Both Express and the container frontend expose the API on this origin.
const API_BASE_URL = '/api';

const CART_STORAGE_KEY = 'cloudbite_cart';
const MY_ORDERS_KEY = 'cloudbite_my_orders';
const ADMIN_TOKEN_KEY = 'cloudbite_admin_token';
const MAX_ITEM_QUANTITY = 50;
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80';

/* ==========================================================================
   Security & Sanitization Helpers
   ========================================================================== */

function sanitizeImageUrl(url, fallback = DEFAULT_IMAGE) {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  // Allow only http, https, or same-origin root/relative paths
  if (/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(trimmed) || /^\.?\/[^\s]*$/i.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

function validateCartItem(item) {
  if (!item || typeof item !== 'object') return null;

  const id = Number(item.id);
  if (isNaN(id) || id <= 0) return null;

  const price = Number(item.price);
  if (isNaN(price) || price < 0 || !isFinite(price)) return null;

  const rawQty = parseInt(item.quantity, 10);
  const quantity = isNaN(rawQty) ? 1 : Math.max(1, Math.min(MAX_ITEM_QUANTITY, rawQty));

  return {
    id: id,
    name: String(item.name || 'Food Item').slice(0, 100).trim(),
    price: price,
    image: sanitizeImageUrl(item.image),
    category: String(item.category || '').slice(0, 50).trim(),
    restaurantId: item.restaurantId ? Number(item.restaurantId) : null,
    quantity: quantity
  };
}

/* ==========================================================================
   Cart Management (localStorage with validation)
   ========================================================================== */

function getCart() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CART_STORAGE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('Malformed cart data found in localStorage. Resetting cart.');
      if (typeof localStorage !== 'undefined') localStorage.removeItem(CART_STORAGE_KEY);
      return [];
    }

    let modified = false;
    const validated = [];
    for (const item of parsed) {
      const validItem = validateCartItem(item);
      if (validItem) {
        if (validItem.quantity !== item.quantity || validItem.price !== item.price) {
          modified = true;
        }
        validated.push(validItem);
      } else {
        modified = true;
      }
    }

    if (modified && typeof localStorage !== 'undefined') {
      saveCart(validated);
    }
    return validated;
  } catch (err) {
    console.error('Error loading cart from localStorage:', err);
    return [];
  }
}

function saveCart(cart) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      updateCartBadge();
    }
  } catch (err) {
    console.error('Error saving cart to localStorage:', err);
  }
}

function addToCart(item) {
  if (!item) return;
  const cart = getCart();
  const existingItemIndex = cart.findIndex(i => Number(i.id) === Number(item.id));

  if (existingItemIndex > -1) {
    if (cart[existingItemIndex].quantity < MAX_ITEM_QUANTITY) {
      cart[existingItemIndex].quantity += 1;
    } else {
      showToast(`Maximum quantity (${MAX_ITEM_QUANTITY}) reached for "${item.name}"`, 'info');
      return;
    }
  } else {
    const valid = validateCartItem({
      ...item,
      quantity: 1
    });
    if (!valid) {
      showToast('Could not add invalid item to cart', 'error');
      return;
    }
    cart.push(valid);
  }

  saveCart(cart);
  showToast(`Added "${item.name}" to cart! 🍕`, 'success');
}

function updateCartItemQuantity(itemId, change) {
  let cart = getCart();
  const index = cart.findIndex(i => Number(i.id) === Number(itemId));

  if (index > -1) {
    const newQty = cart[index].quantity + change;
    if (newQty <= 0) {
      cart.splice(index, 1);
      showToast('Item removed from cart', 'info');
    } else if (newQty > MAX_ITEM_QUANTITY) {
      showToast(`Maximum quantity limit is ${MAX_ITEM_QUANTITY}`, 'info');
      return cart;
    } else {
      cart[index].quantity = newQty;
    }
    saveCart(cart);
  }
  return cart;
}

function removeFromCart(itemId) {
  let cart = getCart();
  cart = cart.filter(i => Number(i.id) !== Number(itemId));
  saveCart(cart);
  showToast('Item removed from cart', 'info');
  return cart;
}

function clearCart() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(CART_STORAGE_KEY);
    updateCartBadge();
  }
}

function getCartTotal() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
}

function getCartCount() {
  const cart = getCart();
  return cart.reduce((count, item) => count + Number(item.quantity), 0);
}

function updateCartBadge() {
  if (typeof document === 'undefined') return;
  const count = getCartCount();
  const badges = document.querySelectorAll('.cart-badge');
  badges.forEach(badge => {
    badge.textContent = count;
    badge.setAttribute('aria-label', `${count} items in cart`);
    badge.setAttribute('aria-live', 'polite');
    badge.style.display = 'inline-block';
  });
}

/* ==========================================================================
   Order Tracking & Access Helpers (Customer vs Admin)
   ========================================================================== */

function getMyOrderAccess() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const data = localStorage.getItem(MY_ORDERS_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.filter(entry =>
      entry && typeof entry.id === 'string' && typeof entry.token === 'string' &&
      /^[a-f0-9]{64}$/i.test(entry.token)
    ) : [];
  } catch (err) {
    return [];
  }
}

function saveMyOrderAccess(orderId, token) {
  try {
    if (!orderId || !/^[a-f0-9]{64}$/i.test(token) || typeof localStorage === 'undefined') return;
    const existing = getMyOrderAccess();
    const cleanId = String(orderId).trim().toUpperCase();
    const updated = existing.filter(entry => entry.id !== cleanId);
    updated.push({ id: cleanId, token });
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save order access:', err);
  }
}

function getAdminToken() {
  if (typeof sessionStorage === 'undefined') return '';
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

function setAdminToken(token) {
  if (typeof sessionStorage === 'undefined') return;
  if (token) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, String(token).trim());
  } else {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

/* ==========================================================================
   Safe UI Helpers: Accessible Toast Notification
   ========================================================================== */

function showToast(message, type = 'success') {
  if (typeof document === 'undefined') return;

  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    container.setAttribute('role', 'status');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  const iconSpan = document.createElement('span');
  iconSpan.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';

  const textSpan = document.createElement('span');
  textSpan.textContent = String(message || '');

  toast.appendChild(iconSpan);
  toast.appendChild(textSpan);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function formatPrice(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '₹0';
  return `₹${num.toFixed(0)}`;
}

/* ==========================================================================
   Global Navbar Initialization & Keyboard Accessibility
   ========================================================================== */

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge();

    // Mobile menu toggle with aria-expanded & keyboard handling
    const mobileToggle = document.querySelector('.mobile-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (mobileToggle && navLinks) {
      if (!navLinks.id) navLinks.id = 'navbarLinks';
      mobileToggle.setAttribute('aria-expanded', 'false');
      mobileToggle.setAttribute('aria-label', 'Toggle navigation menu');
      mobileToggle.setAttribute('aria-controls', navLinks.id);

      const toggleNav = () => {
        const isExpanded = navLinks.classList.toggle('show');
        mobileToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      };

      mobileToggle.addEventListener('click', toggleNav);
      mobileToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleNav();
        }
      });
    }

    // Set active link based on current page
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && currentPath.endsWith(href)) {
        link.classList.add('active');
      }
    });
  });
}

// Export for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateCartItem,
    sanitizeImageUrl,
    getCart,
    saveCart,
    addToCart,
    updateCartItemQuantity,
    removeFromCart,
    clearCart,
    getCartTotal,
    getCartCount,
    formatPrice,
    getMyOrderAccess,
    saveMyOrderAccess,
    getAdminToken,
    setAdminToken,
    showToast
  };
}
