/**
 * CloudBite - Restaurants Listing & Filtering Logic (FR-01)
 * Safe DOM rendering, comprehensive food + restaurant search, and accessible controls
 */

let allRestaurants = [];
let allMenuItems = [];
let currentCuisineFilter = 'all';
let currentSearchQuery = '';
let currentCityFilter = '';

function getRestaurantCity(restaurant) {
  return String(restaurant.city || String(restaurant.location || '').split(',').pop()).trim();
}

function getAvailableCities(restaurants) {
  const cities = new Map();
  restaurants.forEach(restaurant => {
    const city = getRestaurantCity(restaurant);
    if (city && !cities.has(city.toLocaleLowerCase())) {
      cities.set(city.toLocaleLowerCase(), city);
    }
  });
  return [...cities.values()].sort((a, b) => a.localeCompare(b));
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    currentCityFilter = (urlParams.get('city') || '').trim();
    if (searchParam) {
      currentSearchQuery = searchParam.toLowerCase().trim();
      const searchInput = document.getElementById('restaurantSearchInput');
      if (searchInput) searchInput.value = searchParam;
    }

    initRestaurantsPage();
  });
}

async function initRestaurantsPage() {
  const searchInput = document.getElementById('restaurantSearchInput');
  const citySelect = document.getElementById('restaurantCitySelect');
  const chips = document.querySelectorAll('.chip');

  if (citySelect) {
    citySelect.addEventListener('change', (e) => {
      currentCityFilter = e.target.value;
      renderFilteredRestaurants();
    });
  }

  // Search input handler
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.toLowerCase().trim();
      renderFilteredRestaurants();
    });
  }

  // Setup cuisine chip filters with keyboard accessibility
  chips.forEach(chip => {
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-pressed', chip.classList.contains('active') ? 'true' : 'false');

    const handleChipSelection = () => {
      chips.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-pressed', 'true');
      currentCuisineFilter = chip.getAttribute('data-cuisine') || 'all';
      renderFilteredRestaurants();
    };

    chip.addEventListener('click', handleChipSelection);
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleChipSelection();
      }
    });
  });

  // If a cuisine matches the initial search parameter, activate its chip
  if (currentSearchQuery) {
    chips.forEach(chip => {
      const chipCuisine = (chip.getAttribute('data-cuisine') || '').toLowerCase();
      if (chipCuisine && chipCuisine !== 'all' && (chipCuisine === currentSearchQuery || currentSearchQuery.includes(chipCuisine))) {
        chips.forEach(c => {
          c.classList.remove('active');
          c.setAttribute('aria-pressed', 'false');
        });
        chip.classList.add('active');
        chip.setAttribute('aria-pressed', 'true');
        currentCuisineFilter = chip.getAttribute('data-cuisine');
      }
    });
  }

  // Fetch restaurants & menu items from REST API
  await fetchRestaurants();
}

async function fetchRestaurants() {
  const container = document.getElementById('restaurantsGrid');
  if (!container) return;

  container.innerHTML = '';
  const loaderWrapper = document.createElement('div');
  loaderWrapper.className = 'loader-container';
  loaderWrapper.style.gridColumn = '1 / -1';

  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  const loaderText = document.createElement('p');
  loaderText.textContent = 'Loading tasty restaurants & menu dishes...';

  loaderWrapper.appendChild(spinner);
  loaderWrapper.appendChild(loaderText);
  container.appendChild(loaderWrapper);

  try {
    const [restaurantsRes, menuRes] = await Promise.all([
      fetch(`${API_BASE_URL}/restaurants`),
      fetch(`${API_BASE_URL}/menu`).catch(() => null)
    ]);

    if (!restaurantsRes.ok) {
      throw new Error(`Server returned status ${restaurantsRes.status}`);
    }

    const resJson = await restaurantsRes.json();
    if (resJson.success && Array.isArray(resJson.data)) {
      allRestaurants = resJson.data;
      populateCityOptions(allRestaurants);
    } else {
      throw new Error(resJson.message || 'Failed to parse restaurants data.');
    }

    if (menuRes && menuRes.ok) {
      try {
        const menuJson = await menuRes.json();
        if (menuJson.success && Array.isArray(menuJson.data)) {
          allMenuItems = menuJson.data;
        }
      } catch (e) {
        console.warn('Could not parse menu data for food search:', e);
      }
    }

    renderFilteredRestaurants();
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    renderErrorState(container, 'Unable to load restaurants at this time. Please check your network connection and try again.');
    showToast('Failed to connect to backend API', 'error');
  }
}

function populateCityOptions(restaurants) {
  const citySelect = document.getElementById('restaurantCitySelect');
  if (!citySelect) return;

  const cities = getAvailableCities(restaurants);
  citySelect.replaceChildren(new Option('All cities', ''));
  cities.forEach(city => citySelect.add(new Option(city, city)));
  const selected = cities.find(city => city.toLocaleLowerCase() === currentCityFilter.toLocaleLowerCase());
  currentCityFilter = selected || '';
  citySelect.value = currentCityFilter;
}

function renderErrorState(container, message) {
  container.innerHTML = '';
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.style.gridColumn = '1 / -1';

  const icon = document.createElement('div');
  icon.className = 'empty-state-icon';
  icon.textContent = '⚠️';

  const title = document.createElement('h3');
  title.className = 'empty-state-title';
  title.textContent = 'Unable to load restaurants';

  const desc = document.createElement('p');
  desc.className = 'empty-state-text';
  desc.textContent = message;

  const retryBtn = document.createElement('button');
  retryBtn.className = 'btn btn-primary';
  retryBtn.textContent = 'Try Again';
  retryBtn.addEventListener('click', () => fetchRestaurants());

  emptyState.appendChild(icon);
  emptyState.appendChild(title);
  emptyState.appendChild(desc);
  emptyState.appendChild(retryBtn);
  container.appendChild(emptyState);
}

function filterRestaurants(restaurants, menuItems, searchQuery, cuisineFilter, cityFilter = '') {
  const query = (searchQuery || '').toLowerCase().trim();
  const cuisine = (cuisineFilter || 'all').toLowerCase().trim();
  const city = (cityFilter || '').toLocaleLowerCase().trim();

  return restaurants.filter(restaurant => {
    if (city && getRestaurantCity(restaurant).toLocaleLowerCase() !== city) return false;
    // 1. Matches restaurant name, cuisine, location
    const nameMatch = (restaurant.name || '').toLowerCase().includes(query);
    const cuisineMatch = (restaurant.cuisine || '').toLowerCase().includes(query);
    const locationMatch = (restaurant.location || '').toLowerCase().includes(query);

    // 2. Matches food/dish items offered by this restaurant (fulfills homepage food search promise)
    const matchingDishes = (menuItems || []).filter(item =>
      item.restaurantId === restaurant.id &&
      ((item.name || '').toLowerCase().includes(query) ||
       (item.description || '').toLowerCase().includes(query) ||
       (item.category || '').toLowerCase().includes(query))
    );

    const matchesSearch = !query || nameMatch || cuisineMatch || locationMatch || matchingDishes.length > 0;

    const matchesCuisine =
      cuisine === 'all' ||
      (restaurant.cuisine || '').toLowerCase().includes(cuisine);

    // Attach matched dishes temporarily for badge display
    if (matchingDishes.length > 0 && query && !nameMatch && !cuisineMatch) {
      restaurant._matchingDishes = matchingDishes;
    } else {
      delete restaurant._matchingDishes;
    }

    return matchesSearch && matchesCuisine;
  });
}

function renderFilteredRestaurants() {
  const container = document.getElementById('restaurantsGrid');
  const countLabel = document.getElementById('restaurantCountLabel');
  if (!container) return;

  const filtered = filterRestaurants(allRestaurants, allMenuItems, currentSearchQuery, currentCuisineFilter, currentCityFilter);

  if (countLabel) {
    countLabel.textContent = `Showing ${filtered.length} ${filtered.length === 1 ? 'restaurant' : 'restaurants'}`;
  }

  container.innerHTML = '';

  if (filtered.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.style.gridColumn = '1 / -1';

    const icon = document.createElement('div');
    icon.className = 'empty-state-icon';
    icon.textContent = '🔍';

    const title = document.createElement('h3');
    title.className = 'empty-state-title';
    title.textContent = 'No restaurants or dishes found';

    const text = document.createElement('p');
    text.className = 'empty-state-text';
    text.textContent = currentSearchQuery
      ? `No results matched "${currentSearchQuery}". Try searching for popular dishes like biryani, pizza, burger, or check other cuisines.`
      : 'No restaurants match your filter criteria.';

    emptyState.appendChild(icon);
    emptyState.appendChild(title);
    emptyState.appendChild(text);
    container.appendChild(emptyState);
    return;
  }

  // Safe DOM construction for restaurant cards
  const fragment = document.createDocumentFragment();
  const fallbackImg = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80';

  filtered.forEach(restaurant => {
    const card = document.createElement('article');
    card.className = 'restaurant-card';

    // Image section
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'restaurant-image-wrapper';

    const img = document.createElement('img');
    img.src = sanitizeImageUrl(restaurant.image, fallbackImg);
    img.alt = String(restaurant.name || 'Restaurant');
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      img.src = fallbackImg;
    });

    imgWrapper.appendChild(img);
    if (restaurant.deliveryTime) {
      const timeBadge = document.createElement('span');
      timeBadge.className = 'restaurant-time-badge';
      timeBadge.textContent = `⏱️ ${restaurant.deliveryTime}`;
      imgWrapper.appendChild(timeBadge);
    }

    // Body section
    const body = document.createElement('div');
    body.className = 'restaurant-body';

    const header = document.createElement('div');
    header.className = 'restaurant-header';

    const name = document.createElement('h3');
    name.className = 'restaurant-name';
    name.textContent = String(restaurant.name || 'Unnamed Restaurant');

    const rating = document.createElement('span');
    rating.className = 'rating-badge';
    rating.textContent = restaurant.rating == null ? 'No rating' : `★ ${restaurant.rating}`;

    header.appendChild(name);
    header.appendChild(rating);

    const cuisine = document.createElement('div');
    cuisine.className = 'restaurant-cuisine';
    cuisine.textContent = String(restaurant.cuisine || '');

    const desc = document.createElement('p');
    desc.className = 'restaurant-desc';
    desc.textContent = String(restaurant.description || '');

    body.appendChild(header);
    body.appendChild(cuisine);
    body.appendChild(desc);

    // Food match indicator if matched by dish
    if (restaurant._matchingDishes && restaurant._matchingDishes.length > 0) {
      const matchTag = document.createElement('div');
      matchTag.style.cssText = 'margin-top: 0.4rem; font-size: 0.8rem; color: var(--primary); font-weight: 600;';
      const sampleDish = restaurant._matchingDishes[0].name;
      matchTag.textContent = `🍲 Matches dish: "${sampleDish}"`;
      body.appendChild(matchTag);
    }

    // Footer section
    const footer = document.createElement('div');
    footer.className = 'restaurant-footer';

    const locWrapper = document.createElement('div');
    locWrapper.className = 'restaurant-location';
    locWrapper.textContent = '📍 ';
    const locSpan = document.createElement('span');
    locSpan.textContent = String(restaurant.location || '');
    locWrapper.appendChild(locSpan);

    const viewMenuBtn = document.createElement('a');
    viewMenuBtn.href = `menu.html?restaurantId=${encodeURIComponent(restaurant.id)}`;
    viewMenuBtn.className = 'btn btn-primary btn-sm';
    viewMenuBtn.textContent = 'View Menu →';
    viewMenuBtn.setAttribute('aria-label', `View menu for ${restaurant.name}`);

    footer.appendChild(locWrapper);
    footer.appendChild(viewMenuBtn);
    body.appendChild(footer);

    card.appendChild(imgWrapper);
    card.appendChild(body);
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

// Export for Node unit testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    filterRestaurants,
    getAvailableCities
  };
}
