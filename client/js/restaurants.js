/**
 * CloudBite - Restaurants Listing & Filtering Logic (FR-01)
 */

let allRestaurants = [];
let currentCuisineFilter = 'all';
let currentSearchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get('search');
  if (searchParam) {
    currentSearchQuery = searchParam;
    const searchInput = document.getElementById('restaurantSearchInput');
    if (searchInput) searchInput.value = searchParam;
  }

  initRestaurantsPage();
});

async function initRestaurantsPage() {
  const container = document.getElementById('restaurantsGrid');
  const searchInput = document.getElementById('restaurantSearchInput');
  const chips = document.querySelectorAll('.chip');

  // Setup search listener
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.toLowerCase().trim();
      renderFilteredRestaurants();
    });
  }

  // Setup cuisine chip filters
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCuisineFilter = chip.getAttribute('data-cuisine') || 'all';
      renderFilteredRestaurants();
    });
  });

  // Fetch restaurants from REST API
  await fetchRestaurants();
}

async function fetchRestaurants() {
  const container = document.getElementById('restaurantsGrid');
  if (!container) return;

  container.innerHTML = `
    <div class="loader-container" style="grid-column: 1 / -1;">
      <div class="spinner"></div>
      <p>Loading tasty restaurants...</p>
    </div>
  `;

  try {
    const response = await fetch(`${API_BASE_URL}/restaurants`);
    
    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const result = await response.json();

    if (result.success && Array.isArray(result.data)) {
      allRestaurants = result.data;
      renderFilteredRestaurants();
    } else {
      throw new Error(result.message || 'Failed to parse restaurants data.');
    }
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">⚠️</div>
        <h3 class="empty-state-title">Unable to load restaurants</h3>
        <p class="empty-state-text">Make sure the CloudBite backend server is running on port 5000.</p>
        <button class="btn btn-primary" onclick="fetchRestaurants()">Try Again</button>
      </div>
    `;
    showToast('Failed to connect to backend API', 'error');
  }
}

function renderFilteredRestaurants() {
  const container = document.getElementById('restaurantsGrid');
  const countLabel = document.getElementById('restaurantCountLabel');
  if (!container) return;

  const filtered = allRestaurants.filter(restaurant => {
    const matchesSearch = 
      restaurant.name.toLowerCase().includes(currentSearchQuery) ||
      restaurant.cuisine.toLowerCase().includes(currentSearchQuery) ||
      restaurant.location.toLowerCase().includes(currentSearchQuery);

    const matchesCuisine = 
      currentCuisineFilter === 'all' || 
      restaurant.cuisine.toLowerCase().includes(currentCuisineFilter.toLowerCase());

    return matchesSearch && matchesCuisine;
  });

  if (countLabel) {
    countLabel.textContent = `Showing ${filtered.length} ${filtered.length === 1 ? 'restaurant' : 'restaurants'}`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🔍</div>
        <h3 class="empty-state-title">No restaurants found</h3>
        <p class="empty-state-text">No restaurants match your search criteria. Try a different search term or filter.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(restaurant => `
    <article class="restaurant-card">
      <div class="restaurant-image-wrapper">
        <img 
          src="${restaurant.image}" 
          alt="${restaurant.name}" 
          loading="lazy" 
          onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80'"
        />
        <span class="restaurant-time-badge">⏱️ ${restaurant.deliveryTime || '30 mins'}</span>
      </div>
      <div class="restaurant-body">
        <div class="restaurant-header">
          <h3 class="restaurant-name">${restaurant.name}</h3>
          <span class="rating-badge">★ ${restaurant.rating}</span>
        </div>
        <div class="restaurant-cuisine">${restaurant.cuisine}</div>
        <p class="restaurant-desc">${restaurant.description}</p>
        <div class="restaurant-footer">
          <div class="restaurant-location">
            📍 <span>${restaurant.location}</span>
          </div>
          <a href="menu.html?restaurantId=${restaurant.id}" class="btn btn-primary btn-sm">
            View Menu →
          </a>
        </div>
      </div>
    </article>
  `).join('');
}
