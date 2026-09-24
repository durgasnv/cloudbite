/**
 * CloudBite - Restaurant Menu Page Logic (FR-02, FR-03)
 */

let currentRestaurant = null;
let currentMenu = [];
let selectedCategory = 'all';

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('restaurantId') || '1';

  initMenuPage(restaurantId);
});

async function initMenuPage(restaurantId) {
  const bannerContainer = document.getElementById('restaurantBanner');
  const menuContainer = document.getElementById('menuGrid');

  try {
    // 1. Fetch Restaurant details (FR-02)
    const resResponse = await fetch(`${API_BASE_URL}/restaurants/${restaurantId}`);
    if (!resResponse.ok) {
      throw new Error(`Restaurant not found (Status ${resResponse.status})`);
    }
    const resData = await resResponse.json();
    currentRestaurant = resData.data;

    // 2. Fetch Restaurant Menu (FR-03)
    const menuResponse = await fetch(`${API_BASE_URL}/restaurants/${restaurantId}/menu`);
    if (!menuResponse.ok) {
      throw new Error(`Failed to fetch menu (Status ${menuResponse.status})`);
    }
    const menuData = await menuResponse.json();
    currentMenu = menuData.data;

    renderRestaurantBanner(currentRestaurant);
    renderCategoryTabs(currentMenu);
    renderMenuItems();

  } catch (error) {
    console.error('Error loading menu:', error);
    if (bannerContainer) {
      bannerContainer.innerHTML = `
        <div class="empty-state" style="width: 100%;">
          <div class="empty-state-icon">⚠️</div>
          <h3 class="empty-state-title">Restaurant or Menu Not Found</h3>
          <p class="empty-state-text">${error.message}</p>
          <a href="restaurants.html" class="btn btn-primary">Browse All Restaurants</a>
        </div>
      `;
    }
    if (menuContainer) menuContainer.innerHTML = '';
  }
}

function renderRestaurantBanner(restaurant) {
  const banner = document.getElementById('restaurantBanner');
  if (!banner) return;

  banner.innerHTML = `
    <img 
      src="${restaurant.image}" 
      alt="${restaurant.name}" 
      class="restaurant-hero-img"
      onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80'"
    />
    <div class="restaurant-hero-info">
      <h1 class="restaurant-hero-title">${restaurant.name}</h1>
      <p style="color: var(--primary); font-weight: 600; font-size: 1rem;">${restaurant.cuisine}</p>
      <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 0.35rem;">${restaurant.description}</p>
      <div class="restaurant-meta-row">
        <span class="rating-badge">★ ${restaurant.rating}</span>
        <span>⏱️ ${restaurant.deliveryTime || '30 mins'}</span>
        <span>📍 ${restaurant.location}</span>
        <span>💰 ₹${restaurant.priceForTwo || 400} for two</span>
      </div>
    </div>
  `;
}

function renderCategoryTabs(menuItems) {
  const tabContainer = document.getElementById('categoryTabs');
  if (!tabContainer) return;

  // Extract unique categories
  const categories = ['all', ...new Set(menuItems.map(item => item.category))];

  tabContainer.innerHTML = categories.map(cat => {
    const label = cat === 'all' ? 'All Dishes' : cat;
    const activeClass = cat === selectedCategory ? 'active' : '';
    return `<button class="chip ${activeClass}" data-cat="${cat}">${label}</button>`;
  }).join('');

  tabContainer.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      tabContainer.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCategory = btn.getAttribute('data-cat');
      renderMenuItems();
    });
  });
}

function renderMenuItems() {
  const container = document.getElementById('menuGrid');
  if (!container) return;

  const filteredItems = selectedCategory === 'all' 
    ? currentMenu 
    : currentMenu.filter(item => item.category === selectedCategory);

  if (filteredItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🍽️</div>
        <h3 class="empty-state-title">No items in this category</h3>
        <p class="empty-state-text">Check out other categories in the menu above!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredItems.map(item => `
    <div class="food-card">
      <div class="food-details">
        <span class="veg-indicator ${item.isVeg ? 'veg' : 'non-veg'}" title="${item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}"></span>
        <h3 class="food-name">${item.name}</h3>
        <div class="food-price">${formatPrice(item.price)}</div>
        <p class="food-desc">${item.description}</p>
      </div>
      <div class="food-image-section">
        <img 
          src="${item.image}" 
          alt="${item.name}" 
          class="food-thumb"
          loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'"
        />
        <button class="food-add-btn" onclick="handleAddToCart(${item.id})">
          + ADD
        </button>
      </div>
    </div>
  `).join('');
}

// Global handler attached to window for Add To Cart buttons
window.handleAddToCart = function(itemId) {
  const item = currentMenu.find(i => i.id === itemId);
  if (item) {
    addToCart(item);
  }
};
