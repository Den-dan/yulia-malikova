let allPaintings = [];
let currentIndex = 0;
let filtered = [];
const cardPhotoState = new Map();

function isSold(painting) {
  return painting.is_available === false || String(painting.is_available) === 'false';
}

// ===== СОХРАНЕНИЕ/ВОССТАНОВЛЕНИЕ ПРОГРЕССА ПРОСМОТРА ФОТО =====
function savePhotoStateToSession() {
  const obj = {};
  cardPhotoState.forEach((value, key) => { obj[key] = value; });
  sessionStorage.setItem('gallery_photo_state', JSON.stringify(obj));
}

function restorePhotoStateFromSession() {
  const raw = sessionStorage.getItem('gallery_photo_state');
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    Object.keys(obj).forEach(key => {
      cardPhotoState.set(key, obj[key]);
    });
  } catch (e) {
    sessionStorage.removeItem('gallery_photo_state');
  }
}

// ===== СОСТОЯНИЕ ФИЛЬТРОВ =====
const activeFilters = {
  type:      [], // одиночный выбор (category_type)
  genre:     [], // множественный, из painting_tags
  technique: [], // множественный, из painting_tags
  purpose:   [], // множественный, из painting_tags
  size:      [], // вычисляется из width_cm/height_cm
  shape:     [], // вычисляется из width_cm/height_cm
  price:     [], // корзины по цене
  available: [], // is_available
};

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function getSizeLabel(widthCm, heightCm) {
  if (!widthCm || !heightCm) return null;
  const maxSide = Math.max(widthCm, heightCm);
  if (maxSide < 40) return 'Маленький';
  if (maxSide <= 80) return 'Средний';
  return 'Большой';
}

function getShapeLabel(widthCm, heightCm) {
  if (!widthCm || !heightCm) return null;
  return Math.abs(widthCm - heightCm) <= 5 ? 'Квадрат' : 'Прямоугольник';
}

function getCoverImage(painting) {
  if (painting.painting_images && painting.painting_images.length > 0) {
    const sorted = [...painting.painting_images].sort((a, b) => a.sort_order - b.sort_order);
    const cover = sorted.find(img => img.is_cover);
    return (cover || sorted[0]).image_url;
  }
  return painting.image_url || '';
}

function getSavedImage(painting) {
  const savedIndex = cardPhotoState.get(painting.id);
  if (savedIndex) {
    const sorted = painting.painting_images
      ? [...painting.painting_images].sort((a, b) => a.sort_order - b.sort_order)
      : [];
    if (sorted[savedIndex]) return sorted[savedIndex].image_url;
  }
  return getCoverImage(painting);
}

function getPaintingTagValues(painting, category) {
  if (!painting.painting_tags) return [];
  return painting.painting_tags
    .filter(t => t.tag_category === category)
    .map(t => t.tag_value.toLowerCase());
}

function matchesPriceRange(price, range) {
  if (!price) return false;
  const num = parseFloat(String(price).replace(/[^\d.]/g, ''));
  if (isNaN(num)) return false;
  if (range === '0-30000')     return num < 30000;
  if (range === '30000-60000') return num >= 30000 && num < 60000;
  if (range === '60000-100000') return num >= 60000 && num <= 100000;
  if (range === '100000+')     return num > 100000;
  return false;
}

// ===== ФИЛЬТРАЦИЯ =====
function applyFilters() {
  filtered = allPaintings.filter(p => {
    // ТИП
    if (activeFilters.type.length > 0) {
      const pType = (p.category_type || p.category || '').toLowerCase();
      if (!activeFilters.type.some(v => v.toLowerCase() === pType)) return false;
    }

    // ЖАНР
    if (activeFilters.genre.length > 0) {
      const genres = getPaintingTagValues(p, 'genre');
      if (!activeFilters.genre.some(v => genres.includes(v))) return false;
    }

    // ТЕХНИКА
    if (activeFilters.technique.length > 0) {
      const techs = getPaintingTagValues(p, 'technique');
      if (!activeFilters.technique.some(v => techs.includes(v))) return false;
    }

    // НАЗНАЧЕНИЕ
    if (activeFilters.purpose.length > 0) {
      const purposes = getPaintingTagValues(p, 'purpose');
      if (!activeFilters.purpose.some(v => purposes.includes(v))) return false;
    }

    // РАЗМЕР
    if (activeFilters.size.length > 0) {
      const sizeLabel = getSizeLabel(p.width_cm, p.height_cm);
      if (!sizeLabel || !activeFilters.size.includes(sizeLabel)) return false;
    }

    // ФОРМА
    if (activeFilters.shape.length > 0) {
      const shapeLabel = getShapeLabel(p.width_cm, p.height_cm);
      if (!shapeLabel || !activeFilters.shape.includes(shapeLabel)) return false;
    }

    // ЦЕНА
    if (activeFilters.price.length > 0) {
      if (!activeFilters.price.some(range => matchesPriceRange(p.price, range))) return false;
    }

    // НАЛИЧИЕ
    if (activeFilters.available.length > 0) {
      const avail = String(p.is_available);
      if (!activeFilters.available.includes(avail)) return false;
    }

    return true;
  });

  renderGrid();
  updateCount();
}

function hasActiveFilters() {
  return Object.values(activeFilters).some(arr => arr.length > 0);
}

// ===== ОБНОВЛЕНИЕ СЧЁТЧИКА =====
function updateCount() {
  const total = filtered.length;
  const text = total === 0 ? 'Ничего не найдено' : `Найдено: ${total} ${getWordForm(total, 'работа', 'работы', 'работ')}`;
  const el1 = document.getElementById('gallery-count');
  const el2 = document.getElementById('gallery-count-desktop');
  if (el1) el1.textContent = hasActiveFilters() ? text : '';
  if (el2) el2.textContent = hasActiveFilters() ? text : '';
}

function getWordForm(n, one, few, many) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

// ===== РЕНДЕР СЕТКИ =====
function renderGrid() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="color:var(--brown);padding:20px 0;grid-column:1/-1">По выбранным фильтрам работ не найдено</p>';
    return;
  }

  grid.innerHTML = filtered.map((p, i) => `
    <div class="painting-card${isSold(p) ? ' is-sold' : ''}" data-index="${i}">
      <img src="${getSavedImage(p)}" alt="${p.title}" onload="this.classList.add('loaded')">
      <div class="card-dots" style="display:none"></div>
      ${isSold(p) ? '<span class="sold-badge">Продано</span>' : ''}
      <div class="card-overlay">
        <span class="card-title">${p.title}</span>
        <span class="card-label">${p.category_type || p.category || 'Акварель'}</span>
      </div>
    </div>
  `).join('');

  attachCardScrubbing(grid);
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  grid.innerHTML = Array(8).fill(`
    <div class="painting-card loading" style="aspect-ratio:3/4"></div>
  `).join('');

  const { data, error } = await db
    .from('paintings')
    .select('*, painting_images(*), painting_tags(*)')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true });

  if (error || !data) {
    grid.innerHTML = '<p style="color:var(--brown);padding:20px">Работы скоро появятся</p>';
    return;
  }

  allPaintings = data;
  filtered = [...allPaintings];
  renderGrid();
  updateCount();
}

// ===== ПАНЕЛЬ ФИЛЬТРОВ: ИНИЦИАЛИЗАЦИЯ =====
function initFilters() {
  // Переключение чипсов
  document.querySelectorAll('.filter-chips').forEach(group => {
    const filterKey = group.dataset.filter;
    group.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const value = chip.dataset.value;
        const isActive = chip.classList.contains('active');

        // Одиночные фильтры (тип, размер, форма, наличие) — только один активен
        const singleSelect = ['type', 'size', 'shape', 'available'];

        if (singleSelect.includes(filterKey)) {
          group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
          if (!isActive) {
            chip.classList.add('active');
            activeFilters[filterKey] = [value];
          } else {
            activeFilters[filterKey] = [];
          }
        } else {
          // Множественный выбор
          chip.classList.toggle('active');
          if (chip.classList.contains('active')) {
            activeFilters[filterKey].push(value);
          } else {
            activeFilters[filterKey] = activeFilters[filterKey].filter(v => v !== value);
          }
        }

        saveFiltersToSession();
        applyFilters();
      });
    });
  });

  // Кнопка "Сбросить"
  document.getElementById('filters-reset').addEventListener('click', resetFilters);

  // Мобильный drawer
  const toggleBtn = document.getElementById('filters-toggle-btn');
  const closeBtn = document.getElementById('filters-close-btn');
  const panel = document.getElementById('filters-panel');
  const overlay = document.getElementById('filters-overlay');

  function openFiltersPanel() {
    panel.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeFiltersPanel() {
    panel.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (toggleBtn) toggleBtn.addEventListener('click', openFiltersPanel);
  if (closeBtn) closeBtn.addEventListener('click', closeFiltersPanel);
  if (overlay) overlay.addEventListener('click', closeFiltersPanel);
  // Сворачивание панели (десктоп)
  const collapseBtn = document.getElementById('filters-collapse-btn');
  const layout = document.querySelector('.gallery-layout');

  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      const isCollapsed = panel.classList.toggle('collapsed');
      layout.classList.toggle('filters-collapsed', isCollapsed);
      collapseBtn.setAttribute('aria-label', isCollapsed ? 'Развернуть фильтры' : 'Свернуть фильтры');
      collapseBtn.title = isCollapsed ? 'Развернуть фильтры' : 'Свернуть фильтры';
    });
  }
}

function saveFiltersToSession() {
  sessionStorage.setItem('gallery_filters', JSON.stringify(activeFilters));
}

function restoreFiltersFromSession() {
  const raw = sessionStorage.getItem('gallery_filters');
  if (!raw) return;
  const saved = JSON.parse(raw);
  Object.keys(saved).forEach(k => {
    if (activeFilters[k] !== undefined) activeFilters[k] = saved[k];
  });
  // Подсвечиваем активные чипсы
  document.querySelectorAll('.filter-chips').forEach(group => {
    const key = group.dataset.filter;
    group.querySelectorAll('.chip').forEach(chip => {
      if (activeFilters[key] && activeFilters[key].includes(chip.dataset.value)) {
        chip.classList.add('active');
      }
    });
  });
}

function resetFilters() {
  Object.keys(activeFilters).forEach(k => { activeFilters[k] = []; });
  document.querySelectorAll('.chip.active').forEach(c => c.classList.remove('active'));
  sessionStorage.removeItem('gallery_filters');
  filtered = [...allPaintings];
  renderGrid();
  updateCount();
}

// ===== HOVER-СКРАББИНГ ПО ФОТО КАРТИНЫ =====
function attachCardScrubbing(grid) {
  grid.querySelectorAll('.painting-card').forEach(card => {
    const index = parseInt(card.dataset.index, 10);
    const painting = filtered[index];

    let photos = [];
    let activePhoto = 0;
    let requestedPhoto = 0;

    function getSortedImages() {
      if (painting.painting_images && painting.painting_images.length > 0) {
        return [...painting.painting_images].sort((a, b) => a.sort_order - b.sort_order);
      }
      return painting.image_url ? [{ image_url: painting.image_url }] : [];
    }

    function init() {
      photos = getSortedImages();
      if (photos.length <= 1) return;
      const savedIndex = cardPhotoState.get(painting.id);
if (savedIndex && photos[savedIndex]) {
  activePhoto = savedIndex;
}
      const dotsWrap = card.querySelector('.card-dots');
      dotsWrap.innerHTML = photos.map((_, i) =>
  `<span class="card-dot${i === activePhoto ? ' active' : ''}"></span>`
).join('');
      dotsWrap.style.display = 'flex';

      // Добавляем стрелки
      const prevBtn = document.createElement('button');
      prevBtn.className = 'card-prev';
      prevBtn.innerHTML = '←';
      const nextBtn = document.createElement('button');
      nextBtn.className = 'card-next';
      nextBtn.innerHTML = '→';
      card.appendChild(prevBtn);
      card.appendChild(nextBtn);

      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setActivePhoto((activePhoto - 1 + photos.length) % photos.length);
      });
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setActivePhoto((activePhoto + 1) % photos.length);
      });
    }

    function setActivePhoto(i) {
      if (!photos[i] || i === activePhoto) return;
      activePhoto = i;
      requestedPhoto = i;
      cardPhotoState.set(painting.id, i);
      savePhotoStateToSession();
      const img = card.querySelector('img');
      img.classList.add('card-img-loading');
      const newSrc = photos[i].image_url;
      const tempImg = new Image();
      tempImg.onload = () => {
        if (i !== requestedPhoto) return;
        img.src = newSrc;
        img.classList.remove('card-img-loading');
      };
      tempImg.src = newSrc;
      card.querySelectorAll('.card-dot').forEach((dot, idx) => {
        dot.classList.toggle('active', idx === activePhoto);
      });
    }

    init();

    // Свайп для мобильных
    let touchStartX = 0;
    let touchMoved = false;
    const SWIPE_THRESHOLD = 35;

    card.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchMoved = false;
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (photos.length <= 1) return;
      if (Math.abs(e.touches[0].clientX - touchStartX) > SWIPE_THRESHOLD) {
        touchMoved = true;
      }
    }, { passive: true });

    card.addEventListener('touchend', (e) => {
      if (photos.length > 1 && touchMoved) {
        const delta = e.changedTouches[0].clientX - touchStartX;
        if (delta < -SWIPE_THRESHOLD) setActivePhoto((activePhoto + 1) % photos.length);
        if (delta > SWIPE_THRESHOLD) setActivePhoto((activePhoto - 1 + photos.length) % photos.length);
      } else if (!touchMoved) {
        openModal(index);
      }
    });

    card.addEventListener('click', () => {
      if (window.matchMedia('(hover: hover)').matches) openModal(index);
    });
  });
}

// ===== МОДАЛЬНОЕ ОКНО =====
let modalPhotos = [];
let modalPhotoIndex = 0;

function getPaintingPhotos(painting) {
  if (painting.painting_images && painting.painting_images.length > 0) {
    return [...painting.painting_images].sort((a, b) => a.sort_order - b.sort_order);
  }
  return painting.image_url ? [{ image_url: painting.image_url }] : [];
}

function renderModalDots() {
  const dotsWrap = document.getElementById('modal-dots');
  if (!dotsWrap) return;
  if (modalPhotos.length <= 1) {
    dotsWrap.style.display = 'none';
    dotsWrap.innerHTML = '';
    return;
  }
  dotsWrap.style.display = 'flex';
  dotsWrap.innerHTML = modalPhotos.map((_, i) =>
    `<span class="modal-dot${i === modalPhotoIndex ? ' active' : ''}"></span>`
  ).join('');
}

function setModalPhoto(i) {
  if (!modalPhotos[i]) return;
  modalPhotoIndex = i;
  const img = document.getElementById('modal-img');
  img.classList.remove('loaded');
  img.src = modalPhotos[i].image_url;
  img.onload = () => img.classList.add('loaded');
  renderModalDots();
}

function openModal(index) {
  currentIndex = index;
  const p = filtered[index];

  modalPhotos = getPaintingPhotos(p);
  modalPhotoIndex = 0;

  const img = document.getElementById('modal-img');
  img.classList.remove('loaded');
  if (modalPhotos[0]) {
    img.src = modalPhotos[0].image_url;
    img.onload = () => img.classList.add('loaded');
  } else {
    img.src = '';
  }
  renderModalDots();

  document.getElementById('modal-title').textContent = p.title;
  document.getElementById('modal-category').textContent = p.category_type || p.category || '';
  document.getElementById('modal-desc').textContent = p.description || '';

  const modalSoldBadge = document.getElementById('modal-sold-badge');
  if (modalSoldBadge) {
    modalSoldBadge.style.display = isSold(p) ? 'inline-block' : 'none';
  }

  const sizeLabel = getSizeLabel(p.width_cm, p.height_cm);
  const dimText = (p.width_cm && p.height_cm) ? `${p.width_cm}×${p.height_cm} см` : (p.size || '');
  document.getElementById('modal-size').textContent = dimText ? `Размер: ${dimText}` : '';

  document.getElementById('modal-material').textContent = p.material ? `Материал: ${p.material}` : '';
  document.getElementById('modal-year').textContent = p.year ? `Год: ${p.year}` : '';
  document.getElementById('modal-price').textContent = p.price ? `Цена: ${p.price} ₸` : '';

  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
  const url = new URL(window.location);
  if (url.searchParams.has('painting')) {
    url.searchParams.delete('painting');
    history.replaceState(null, '', url);
  }
}

// ===== DEEP LINK: gallery.html?painting=ID (Шаг 7) =====
async function checkDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const paintingId = params.get('painting');
  if (!paintingId) return;

  // Ждём загрузки данных
  const waitForData = () => new Promise(resolve => {
    if (allPaintings.length > 0) return resolve();
    const interval = setInterval(() => {
      if (allPaintings.length > 0) { clearInterval(interval); resolve(); }
    }, 50);
  });

  await waitForData();

  const idx = filtered.findIndex(p => p.id === paintingId);
  if (idx !== -1) openModal(idx);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.getElementById('modal-close').onclick = closeModal;
document.getElementById('modal-overlay').onclick = closeModal;

document.getElementById('modal-prev').onclick = () => {
  if (modalPhotos.length <= 1) return;
  setModalPhoto((modalPhotoIndex - 1 + modalPhotos.length) % modalPhotos.length);
};
document.getElementById('modal-next').onclick = () => {
  if (modalPhotos.length <= 1) return;
  setModalPhoto((modalPhotoIndex + 1) % modalPhotos.length);
};

let hoveredCard = null;

document.querySelectorAll && document.addEventListener('mouseover', e => {
  const card = e.target.closest('.painting-card');
  hoveredCard = card || null;
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();

  const modalOpen = document.getElementById('modal').classList.contains('open');

  if (modalOpen) {
    if (e.key === 'ArrowLeft') document.getElementById('modal-prev').click();
    if (e.key === 'ArrowRight') document.getElementById('modal-next').click();
  } else if (hoveredCard) {
    if (e.key === 'ArrowLeft') hoveredCard.querySelector('.card-prev')?.click();
    if (e.key === 'ArrowRight') hoveredCard.querySelector('.card-next')?.click();
  }
});

initFilters();
restoreFiltersFromSession();
restorePhotoStateFromSession();

// Фильтры свёрнуты по умолчанию на десктопе
const _panel = document.getElementById('filters-panel');
const _layout = document.querySelector('.gallery-layout');
if (_panel && _layout && window.innerWidth > 900) {
  _layout.style.transition = 'none';
  _panel.classList.add('collapsed');
  _layout.classList.add('filters-collapsed');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      _layout.style.transition = '';
    });
  });
}

loadGallery().then(() => {
  if (sessionStorage.getItem('gallery_filters')) applyFilters();
  checkDeepLink();
});