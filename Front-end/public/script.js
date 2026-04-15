const API_URL = '/api/businesses';

const form = document.getElementById('business-form');
const businessCards = document.getElementById('business-cards');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const formTitle = document.getElementById('form-title');

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
    alert('No se pudo guardar el negocio.');
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
  } catch (error) {
    businessCards.innerHTML = '<p>No fue posible cargar los negocios.</p>';
    console.error(error);
  }
}

function renderBusinesses(businesses) {
  if (businesses.length === 0) {
    businessCards.innerHTML = '<p>No se encontraron negocios.</p>';
    return;
  }

  businessCards.innerHTML = businesses
    .map((business) => {
      const reviews = Array.isArray(business.reviews) ? business.reviews : [];
      return `
        <div class="business-card">
          <h3>${escapeHtml(business.name)}</h3>
          <p><strong>Direccion:</strong> ${escapeHtml(business.address)}</p>
          <p><strong>Categoria:</strong> ${escapeHtml(business.category)}</p>
          <p><strong>Telefono:</strong> ${escapeHtml(business.phone)}</p>
          <p><strong>Horario:</strong> ${escapeHtml(business.hours)}</p>
          <div class="actions">
            <button class="edit-btn" onclick="editBusiness(${business.id})">Editar</button>
            <button class="delete-btn" onclick="deleteBusiness(${business.id})">Eliminar</button>
          </div>
          <div class="review-section">
            <textarea class="review-input" placeholder="Escribe una resena..." id="review-${business.id}"></textarea>
            <button class="submit-review" onclick="addReview(${business.id})">Enviar resena</button>
            <div id="reviews-${business.id}">
              ${reviews.map((review) => `<div class="review">${escapeHtml(review.review_text)}</div>`).join('')}
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
    alert('No se pudo eliminar el negocio.');
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
    alert('No se pudo enviar la resena.');
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
