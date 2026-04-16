const API_URL = '/api/businesses';

const form = document.getElementById('business-form');
const businessCards = document.getElementById('business-cards');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const formTitle = document.getElementById('form-title');
const totalBusinesses = document.getElementById('total-businesses');
const totalCategories = document.getElementById('total-categories');
const totalReviews = document.getElementById('total-reviews');
const resultsSummary = document.getElementById('results-summary');

let currentEditId = null;
let businessesCache = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchBusinesses();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById('name').value.trim(),
    address: document.getElementById('address').value.trim(),
    category: document.getElementById('category').value.trim().toLowerCase(),
    phone: document.getElementById('phone').value.trim(),
    hours: document.getElementById('hours').value.trim(),
  };

  try {
    const response = await fetch(currentEditId ? `${API_URL}/${currentEditId}` : API_URL, {
      method: currentEditId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    currentEditId = null;
    formTitle.textContent = 'Agregar nuevo negocio';
    form.reset();
    await fetchBusinesses(searchInput.value, categoryFilter.value);
  } catch (error) {
    alert(getFriendlyErrorMessage(error, 'guardar el negocio'));
    console.error(error);
  }
});

searchInput.addEventListener('input', () => {
  fetchBusinesses(searchInput.value, categoryFilter.value);
});

categoryFilter.addEventListener('change', () => {
  fetchBusinesses(searchInput.value, categoryFilter.value);
});

async function fetchBusinesses(query = '', category = '') {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(await response.text());
    }

    businessesCache = await response.json();
    const normalizedQuery = query.trim().toLowerCase();
    const filteredBusinesses = businessesCache.filter((business) => {
      const matchesQuery =
        !normalizedQuery ||
        business.name.toLowerCase().includes(normalizedQuery) ||
        business.category.toLowerCase().includes(normalizedQuery);
      const matchesCategory = !category || business.category === category;
      return matchesQuery && matchesCategory;
    });

    renderBusinesses(filteredBusinesses);
    populateCategoryFilter(businessesCache, category);
    updateStats(businessesCache, filteredBusinesses);
  } catch (error) {
    businessCards.innerHTML = `<div class="empty-state"><p>${escapeHtml(getFriendlyErrorMessage(error, 'cargar los negocios'))}</p></div>`;
    console.error(error);
  }
}

function renderBusinesses(businesses) {
  if (businesses.length === 0) {
    businessCards.innerHTML = `
      <div class="empty-state">
        <p>No se encontraron negocios con los filtros actuales.</p>
      </div>
    `;
    return;
  }

  businessCards.innerHTML = businesses
    .map((business) => {
      const reviews = Array.isArray(business.reviews) ? business.reviews : [];
      const reviewLabel = reviews.length === 1 ? '1 resena' : `${reviews.length} resenas`;
      return `
        <div class="business-card">
          <div class="business-card-top">
            <div>
              <span class="business-tag">${escapeHtml(capitalize(business.category))}</span>
              <h3>${escapeHtml(business.name)}</h3>
            </div>
            <span class="business-count">${reviewLabel}</span>
          </div>
          <div class="business-meta">
            <p><strong>Direccion</strong><span>${escapeHtml(business.address)}</span></p>
            <p><strong>Categoria</strong><span>${escapeHtml(capitalize(business.category))}</span></p>
            <p><strong>Telefono</strong><span>${escapeHtml(business.phone)}</span></p>
            <p><strong>Horario</strong><span>${escapeHtml(business.hours)}</span></p>
          </div>
          <div class="actions">
            <button class="edit-btn" onclick="editBusiness(${business.id})">Editar</button>
            <button class="delete-btn" onclick="deleteBusiness(${business.id})">Eliminar</button>
          </div>
          <div class="review-section">
            <textarea class="review-input" placeholder="Escribe una resena..." id="review-${business.id}"></textarea>
            <button class="submit-review" onclick="addReview(${business.id})">Enviar resena</button>
            <div class="reviews-list" id="reviews-${business.id}">
              ${
                reviews.length > 0
                  ? reviews.map((review) => `<div class="review">${escapeHtml(review.review_text)}</div>`).join('')
                  : '<p class="empty-reviews">Aun no hay resenas para este negocio.</p>'
              }
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

function editBusiness(id) {
  const business = businessesCache.find((item) => item.id === id);
  if (!business) {
    return;
  }

  document.getElementById('name').value = business.name;
  document.getElementById('address').value = business.address;
  document.getElementById('category').value = business.category;
  document.getElementById('phone').value = business.phone;
  document.getElementById('hours').value = business.hours;
  currentEditId = id;
  formTitle.textContent = 'Editar negocio';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteBusiness(id) {
  if (!confirm('\u00bfSeguro que deseas eliminar este negocio?')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(await response.text());
    }

    if (currentEditId === id) {
      currentEditId = null;
      form.reset();
      formTitle.textContent = 'Agregar nuevo negocio';
    }

    await fetchBusinesses(searchInput.value, categoryFilter.value);
  } catch (error) {
    alert(getFriendlyErrorMessage(error, 'eliminar el negocio'));
    console.error(error);
  }
}

async function addReview(id) {
  const textarea = document.getElementById(`review-${id}`);
  const reviewText = textarea.value.trim();

  if (!reviewText) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/${id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_text: reviewText }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    textarea.value = '';
    await fetchBusinesses(searchInput.value, categoryFilter.value);
  } catch (error) {
    alert(getFriendlyErrorMessage(error, 'enviar la resena'));
    console.error(error);
  }
}

function populateCategoryFilter(businesses, selectedCategory = '') {
  const categories = [...new Set(businesses.map((business) => business.category))].sort();
  categoryFilter.innerHTML = '<option value="">Todas las categorias</option>';

  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    categoryFilter.appendChild(option);
  });

  categoryFilter.value = selectedCategory;
}

function updateStats(allBusinesses, filteredBusinesses) {
  const categories = new Set(allBusinesses.map((business) => business.category));
  const reviews = allBusinesses.reduce((total, business) => {
    const currentReviews = Array.isArray(business.reviews) ? business.reviews.length : 0;
    return total + currentReviews;
  }, 0);

  totalBusinesses.textContent = allBusinesses.length;
  totalCategories.textContent = categories.size;
  totalReviews.textContent = reviews;

  const label = filteredBusinesses.length === 1 ? 'negocio' : 'negocios';
  if (filteredBusinesses.length === allBusinesses.length) {
    resultsSummary.textContent = `Mostrando ${filteredBusinesses.length} ${label} registrados.`;
  } else {
    resultsSummary.textContent = `Mostrando ${filteredBusinesses.length} de ${allBusinesses.length} ${allBusinesses.length === 1 ? 'negocio' : 'negocios'}.`;
  }
}

function capitalize(value) {
  if (!value) {
    return '';
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getFriendlyErrorMessage(error, action) {
  if (window.location.protocol === 'file:') {
    return `No se pudo ${action}. Abre la app desde http://localhost:5000 con el servidor Node encendido, no directamente como archivo.`;
  }

  if (error instanceof TypeError) {
    return `No se pudo ${action}. Revisa que el servidor este corriendo y abre la app desde http://localhost:5000.`;
  }

  return `No se pudo ${action}.`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

window.editBusiness = editBusiness;
window.deleteBusiness = deleteBusiness;
window.addReview = addReview;
