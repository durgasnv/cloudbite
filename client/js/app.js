/**
 * CloudBite - Shared Application Utilities & Cart Management
 */

// API Base URL Configuration
const API_BASE_URL = window.location.origin.includes('5000') 
  ? '/api' 
  : 'http://localhost:5000/api';

const CART_STORAGE_KEY = 'cloudbite_cart';

/* ==========================================================================
   Cart Management (localStorage)
   ========================================================================== */

function getCart() {
  try {
    const data = localStorage.getItem(CART_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Error loading cart from localStorage:', err);
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    updateCartBadge();
  } catch (err) {
    console.error('Error saving cart to localStorage:', err);
  }
}

function addToCart(item) {
  const cart = getCart();
  const existingItemIndex = cart.findIndex(i => i.id === item.id);

  if (existingItemIndex > -1) {
    cart[existingItemIndex].quantity += 1;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      image: item.image,
      category: item.category,
      restaurantId: item.restaurantId,
      quantity: 1
    });
  }

  saveCart(cart);
  showToast(`Added "${item.name}" to cart! 🍕`, 'success');
}

function updateCartItemQuantity(itemId, change) {
  let cart = getCart();
  const index = cart.findIndex(i => i.id === itemId);

  if (index > -1) {
    cart[index].quantity += change;
    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
      showToast('Item removed from cart', 'info');
    }
    saveCart(cart);
  }
  return cart;
}

function removeFromCart(itemId) {
  let cart = getCart();
  cart = cart.filter(i => i.id !== itemId);
  saveCart(cart);
  showToast('Item removed from cart', 'info');
  return cart;
}

function clearCart() {
  localStorage.removeItem(CART_STORAGE_KEY);
  updateCartBadge();
}

function getCartTotal() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function getCartCount() {
  const cart = getCart();
  return cart.reduce((count, item) => count + item.quantity, 0);
}

function updateCartBadge() {
  const count = getCartCount();
  const badges = document.querySelectorAll('.cart-badge');
  badges.forEach(badge => {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'inline-block';
  });
}

/* ==========================================================================
   UI Helpers: Toast Notification
   ========================================================================== */

function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatPrice(amount) {
  return `₹${Number(amount).toFixed(0)}`;
}

/* ==========================================================================
   Global Navbar Initialization & Active Links
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();

  // Mobile menu toggle
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('show');
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
