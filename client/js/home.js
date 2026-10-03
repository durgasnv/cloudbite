/** Show a small, mixed-source catalog preview on the homepage. */

function pickFeaturedRestaurants(restaurants, limit = 6) {
  const bySource = new Map();
  for (const restaurant of restaurants) {
    const source = restaurant.source || 'Other';
    if (!bySource.has(source)) bySource.set(source, []);
    bySource.get(source).push(restaurant);
  }
  const groups = [...bySource.values()];
  const selected = [];
  while (selected.length < limit && groups.some(group => group.length)) {
    for (const group of groups) {
      if (group.length && selected.length < limit) selected.push(group.shift());
    }
  }
  return selected;
}

function renderFeaturedRestaurants(container, restaurants) {
  container.replaceChildren();
  if (!restaurants.length) {
    container.textContent = 'No restaurants are available right now.';
    return;
  }
  for (const restaurant of restaurants) {
    const card = document.createElement('article');
    card.className = 'restaurant-card';

    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'restaurant-image-wrapper';
    const image = document.createElement('img');
    image.src = sanitizeImageUrl(restaurant.image);
    image.alt = String(restaurant.name || 'Restaurant');
    image.loading = 'lazy';
    imageWrapper.appendChild(image);

    const body = document.createElement('div');
    body.className = 'restaurant-body';
    const header = document.createElement('div');
    header.className = 'restaurant-header';
    const name = document.createElement('h3');
    name.className = 'restaurant-name';
    name.textContent = String(restaurant.name || 'Restaurant');
    const rating = document.createElement('span');
    rating.className = 'rating-badge';
    rating.textContent = restaurant.rating == null ? 'No rating' : `★ ${restaurant.rating}`;
    header.append(name, rating);

    const cuisine = document.createElement('p');
    cuisine.className = 'restaurant-cuisine';
    cuisine.textContent = String(restaurant.cuisine || 'Various');
    const footer = document.createElement('div');
    footer.className = 'restaurant-footer';
    const location = document.createElement('span');
    location.className = 'restaurant-location';
    location.textContent = `📍 ${restaurant.location || restaurant.city || ''}`;
    const link = document.createElement('a');
    link.className = 'btn btn-primary btn-sm';
    link.href = `menu.html?restaurantId=${encodeURIComponent(restaurant.id)}`;
    link.textContent = 'View Menu';
    footer.append(location, link);
    body.append(header, cuisine, footer);
    card.append(imageWrapper, body);
    container.appendChild(card);
  }
}

async function loadFeaturedRestaurants() {
  const container = document.getElementById('featuredRestaurants');
  if (!container) return;
  try {
    const response = await fetch(`${API_BASE_URL}/restaurants`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (!body.success || !Array.isArray(body.data)) throw new Error('Invalid restaurant response');
    renderFeaturedRestaurants(container, pickFeaturedRestaurants(body.data));
  } catch (error) {
    console.error('Could not load homepage restaurants:', error);
    container.textContent = 'Restaurants could not load. Check that the CloudBite API is running.';
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadFeaturedRestaurants);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { pickFeaturedRestaurants };
}
