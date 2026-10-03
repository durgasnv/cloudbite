/**
 * CloudBite - Restaurant Menu Page Logic (FR-02, FR-03)
 * Safe DOM rendering, accessible controls, and resilient error states
 */

let currentRestaurant = null;
let currentMenu = [];
let selectedCategory = 'all';

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const restaurantId = urlParams.get('restaurantId') || '1';
    initMenuPage(restaurantId);
  });
}

async function initMenuPage(restaurantId) {
  const bannerContainer = document.getElementById('restaurantBanner');
  const menuContainer = document.getElementById('menuGrid');

  try {
    // 1. Fetch Restaurant details (FR-02)
    const resResponse = await fetch(`${API_BASE_URL}/restaurants/${encodeURIComponent(restaurantId)}`);
    if (!resResponse.ok) {
      throw new Error(`Restaurant not found (Status ${resResponse.status})`);
    }
    const resData = await resResponse.json();
    currentRestaurant = resData.data;

    // 2. Fetch Restaurant Menu (FR-03)
    const menuResponse = await fetch(`${API_BASE_URL}/restaurants/${encodeURIComponent(restaurantId)}/menu`);
    if (!menuResponse.ok) {
      throw new Error(`Failed to fetch menu (Status ${menuResponse.status})`);
    }
    const menuData = await menuResponse.json();
    currentMenu = Array.isArray(menuData.data) ? menuData.data : [];

    renderRestaurantBanner(currentRestaurant);
    renderCategoryTabs(currentMenu);
    renderMenuItems();

  } catch (error) {
    console.error('Error loading menu:', error);
    if (bannerContainer) {
      bannerContainer.innerHTML = '';
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.style.width = '100%';

      const icon = document.createElement('div');
      icon.className = 'empty-state-icon';
      icon.textContent = '⚠️';

      const title = document.createElement('h3');
      title.className = 'empty-state-title';
      title.textContent = 'Restaurant or Menu Not Found';

      const desc = document.createElement('p');
      desc.className = 'empty-state-text';
      desc.textContent = error.message || 'Unable to retrieve menu details.';

      const browseLink = document.createElement('a');
      browseLink.href = 'restaurants.html';
      browseLink.className = 'btn btn-primary';
      browseLink.textContent = 'Browse All Restaurants';

      emptyState.appendChild(icon);
      emptyState.appendChild(title);
      emptyState.appendChild(desc);
      emptyState.appendChild(browseLink);
      bannerContainer.appendChild(emptyState);
    }
    if (menuContainer) menuContainer.innerHTML = '';
  }
}

function renderRestaurantBanner(restaurant) {
  const banner = document.getElementById('restaurantBanner');
  if (!banner || !restaurant) return;

  banner.innerHTML = '';
  const fallbackHero = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80';

  const heroImg = document.createElement('img');
  heroImg.src = sanitizeImageUrl(restaurant.image, fallbackHero);
  heroImg.alt = String(restaurant.name || 'Restaurant');
  heroImg.className = 'restaurant-hero-img';
  heroImg.addEventListener('error', () => {
    heroImg.src = fallbackHero;
  });

  const heroInfo = document.createElement('div');
  heroInfo.className = 'restaurant-hero-info';

  const title = document.createElement('h1');
  title.className = 'restaurant-hero-title';
  title.textContent = String(restaurant.name || '');

  const cuisineP = document.createElement('p');
  cuisineP.style.cssText = 'color: var(--primary); font-weight: 600; font-size: 1rem;';
  cuisineP.textContent = String(restaurant.cuisine || '');

  const descP = document.createElement('p');
  descP.style.cssText = 'color: var(--text-muted); font-size: 0.95rem; margin-top: 0.35rem;';
  descP.textContent = String(restaurant.description || '');

  const metaRow = document.createElement('div');
  metaRow.className = 'restaurant-meta-row';

  const ratingSpan = document.createElement('span');
  ratingSpan.className = 'rating-badge';
  ratingSpan.textContent = restaurant.rating == null ? 'No rating' : `★ ${restaurant.rating}`;

  const timeSpan = document.createElement('span');
  if (restaurant.deliveryTime) timeSpan.textContent = `⏱️ ${restaurant.deliveryTime}`;

  const locSpan = document.createElement('span');
  locSpan.textContent = `📍 ${restaurant.location || ''}`;

  const priceSpan = document.createElement('span');
  if (restaurant.priceForTwo != null) priceSpan.textContent = `💰 ₹${restaurant.priceForTwo} for two`;

  metaRow.appendChild(ratingSpan);
  if (restaurant.deliveryTime) metaRow.appendChild(timeSpan);
  metaRow.appendChild(locSpan);
  if (restaurant.priceForTwo != null) metaRow.appendChild(priceSpan);

  heroInfo.appendChild(title);
  heroInfo.appendChild(cuisineP);
  heroInfo.appendChild(descP);
  heroInfo.appendChild(metaRow);

  banner.appendChild(heroImg);
  banner.appendChild(heroInfo);
}

function renderCategoryTabs(menuItems) {
  const tabContainer = document.getElementById('categoryTabs');
  if (!tabContainer) return;

  const categories = ['all', ...new Set(menuItems.map(item => item.category).filter(Boolean))];
  tabContainer.innerHTML = '';

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `chip ${cat === selectedCategory ? 'active' : ''}`;
    btn.setAttribute('data-cat', cat);
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-pressed', cat === selectedCategory ? 'true' : 'false');
    btn.textContent = cat === 'all' ? 'All Dishes' : cat;

    const selectCategory = () => {
      tabContainer.querySelectorAll('.chip').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      selectedCategory = cat;
      renderMenuItems();
    };

    btn.addEventListener('click', selectCategory);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCategory();
      }
    });

    tabContainer.appendChild(btn);
  });
}

function renderMenuItems() {
  const container = document.getElementById('menuGrid');
  if (!container) return;

  const filteredItems = selectedCategory === 'all'
    ? currentMenu
    : currentMenu.filter(item => item.category === selectedCategory);

  container.innerHTML = '';

  if (filteredItems.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.style.gridColumn = '1 / -1';

    const icon = document.createElement('div');
    icon.className = 'empty-state-icon';
    icon.textContent = '🍽️';

    const title = document.createElement('h3');
    title.className = 'empty-state-title';
    title.textContent = 'No items in this category';

    const desc = document.createElement('p');
    desc.className = 'empty-state-text';
    desc.textContent = 'Check out other categories in the menu above!';

    emptyState.appendChild(icon);
    emptyState.appendChild(title);
    emptyState.appendChild(desc);
    container.appendChild(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();
  const fallbackFood = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80';

  filteredItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'food-card';

    // Food details
    const details = document.createElement('div');
    details.className = 'food-details';

    const vegInd = document.createElement('span');
    if (typeof item.isVeg === 'boolean') {
      vegInd.className = `veg-indicator ${item.isVeg ? 'veg' : 'non-veg'}`;
      vegInd.title = item.isVeg ? 'Vegetarian' : 'Non-Vegetarian';
      vegInd.setAttribute('aria-label', item.isVeg ? 'Vegetarian' : 'Non-Vegetarian');
    }

    const foodName = document.createElement('h3');
    foodName.className = 'food-name';
    foodName.textContent = String(item.name || 'Food Item');

    const priceDiv = document.createElement('div');
    priceDiv.className = 'food-price';
    priceDiv.textContent = formatPrice(item.price);

    const descP = document.createElement('p');
    descP.className = 'food-desc';
    descP.textContent = String(item.description || '');

    if (typeof item.isVeg === 'boolean') details.appendChild(vegInd);
    details.appendChild(foodName);
    details.appendChild(priceDiv);
    details.appendChild(descP);

    // Image section
    const imgSection = document.createElement('div');
    imgSection.className = 'food-image-section';

    const img = document.createElement('img');
    img.src = sanitizeImageUrl(item.image, fallbackFood);
    img.alt = String(item.name || 'Food Item');
    img.className = 'food-thumb';
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      img.src = fallbackFood;
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'food-add-btn';
    addBtn.textContent = '+ ADD';
    addBtn.setAttribute('aria-label', `Add ${item.name} to cart`);
    addBtn.addEventListener('click', () => {
      addToCart(item);
    });

    imgSection.appendChild(img);
    imgSection.appendChild(addBtn);

    card.appendChild(details);
    card.appendChild(imgSection);
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}
