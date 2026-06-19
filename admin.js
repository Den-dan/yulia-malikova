let editingId = null;
let paintings = [];

// ПРОВЕРКА СЕССИИ
async function checkSession() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    showAdmin();
  }
}

// ВХОД
document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const error_el = document.getElementById('login-error');

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    error_el.textContent = 'Неверный email или пароль';
  } else {
    showAdmin();
  }
});

// ВЫХОД
document.getElementById('logout-btn').addEventListener('click', async () => {
  await db.auth.signOut();
  document.getElementById('admin-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
});

function showAdmin() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-screen').style.display = 'block';
  loadPaintings();
  loadSiteImages();
}

// ЗАГРУЗКА КАРТИН
async function loadPaintings() {
  const { data, error } = await db
    .from('paintings')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return;
  paintings = data;
  renderPaintings();
}

function renderPaintings() {
  const grid = document.getElementById('admin-grid');
  grid.innerHTML = paintings.map(p => `
    <div class="admin-card">
      <img src="${p.image_url || ''}" alt="${p.title}"
           onerror="this.style.display='none'">
      <div class="admin-card-info">
        <div class="admin-card-order">
          <span class="label">Порядок</span>
          <input
            type="number"
            class="order-input"
            value="${p.sort_order || 0}"
            min="0"
            onchange="updateOrder('${p.id}', this.value)"
          >
        </div>
        <h3>${p.title}</h3>
        <span class="label">${p.category || ''}</span>
        ${!p.is_visible ? '<span class="hidden-badge">Скрыта</span>' : ''}
        <div class="admin-card-actions">
          <button onclick="openEdit('${p.id}')">Изменить</button>
          <button onclick="toggleVisible('${p.id}', ${p.is_visible})">
            ${p.is_visible ? 'Скрыть' : 'Показать'}
          </button>
          <button class="danger" onclick="deletePainting('${p.id}')">Удалить</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ДОБАВИТЬ
document.getElementById('add-btn').addEventListener('click', () => {
  editingId = null;
  document.getElementById('edit-title').textContent = 'Добавить картину';
  document.getElementById('edit-name').value = '';
  document.getElementById('edit-desc').value = '';
  document.getElementById('edit-year').value = '';
  document.getElementById('edit-size').value = '';
  document.getElementById('edit-material').value = '';
  document.getElementById('edit-price').value = '';
  document.getElementById('edit-visible').checked = true;
  document.getElementById('edit-featured').checked = false;
  document.getElementById('edit-preview').style.display = 'none';
  document.getElementById('edit-status').textContent = '';
  document.getElementById('edit-modal').classList.add('open');
});

// РЕДАКТИРОВАТЬ
function openEdit(id) {
  const p = paintings.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('edit-title').textContent = 'Редактировать';
  document.getElementById('edit-name').value = p.title || '';
  document.getElementById('edit-desc').value = p.description || '';
  document.getElementById('edit-category').value = p.category || 'Пейзаж';
  document.getElementById('edit-year').value = p.year || '';
  document.getElementById('edit-size').value = p.size || '';
  document.getElementById('edit-material').value = p.material || '';
  document.getElementById('edit-price').value = p.price || '';
  document.getElementById('edit-visible').checked = p.is_visible;
  document.getElementById('edit-featured').checked = p.is_featured;
  document.getElementById('edit-status').textContent = '';
  if (p.image_url) {
    const prev = document.getElementById('edit-preview');
    prev.src = p.image_url;
    prev.style.display = 'block';
  }
  document.getElementById('edit-modal').classList.add('open');
}

// ПРЕВЬЮ ФОТО
document.getElementById('edit-image').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const prev = document.getElementById('edit-preview');
  prev.src = URL.createObjectURL(file);
  prev.style.display = 'block';
});

// СОХРАНИТЬ
document.getElementById('edit-save').addEventListener('click', async () => {
  const status = document.getElementById('edit-status');
  const title = document.getElementById('edit-name').value.trim();
  if (!title) { status.textContent = 'Введите название'; return; }

  status.textContent = 'Сохраняем...';

  let image_url = null;
  const file = document.getElementById('edit-image').files[0];

  if (file) {
    const ext = file.name.split('.').pop();
    const filename = `${Date.now()}.${ext}`;
    const { error: uploadError } = await db.storage
      .from('paintings')
      .upload(filename, file);

    if (uploadError) {
      status.textContent = 'Ошибка загрузки фото';
      return;
    }

    const { data: urlData } = db.storage.from('paintings').getPublicUrl(filename);
    image_url = urlData.publicUrl;
  }

  const payload = {
    title,
    description: document.getElementById('edit-desc').value,
    category: document.getElementById('edit-category').value,
    year: parseInt(document.getElementById('edit-year').value) || null,
    size: document.getElementById('edit-size').value,
    material: document.getElementById('edit-material').value,
    price: document.getElementById('edit-price').value,
    is_visible: document.getElementById('edit-visible').checked,
    is_featured: document.getElementById('edit-featured').checked,
  };

  if (image_url) payload.image_url = image_url;

  let error;
  if (editingId) {
    ({ error } = await db.from('paintings').update(payload).eq('id', editingId));
  } else {
    ({ error } = await db.from('paintings').insert(payload));
  }

  if (error) {
    status.textContent = 'Ошибка: ' + error.message;
  } else {
    closeEditModal();
    loadPaintings();
  }
});

async function updateOrder(id, value) {
  await db.from('paintings').update({ sort_order: parseInt(value) || 0 }).eq('id', id);
  const { data } = await db
    .from('paintings')
    .select('*')
    .order('sort_order', { ascending: true });
  if (data) {
    paintings = data;
    renderPaintings();
  }
}

// СКРЫТЬ/ПОКАЗАТЬ
async function toggleVisible(id, current) {
  await db.from('paintings').update({ is_visible: !current }).eq('id', id);
  loadPaintings();
}

// УДАЛИТЬ
async function deletePainting(id) {
  if (!confirm('Удалить картину?')) return;
  await db.from('paintings').delete().eq('id', id);
  loadPaintings();
}

// ЗАКРЫТЬ МОДАЛКУ
function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open');
  document.getElementById('edit-image').value = '';
}

document.getElementById('edit-cancel').onclick = closeEditModal;
document.getElementById('edit-overlay').onclick = closeEditModal;

checkSession();

// ЗАГРУЗКА HERO И ФОТО ХУДОЖНИКА
async function loadSiteImages() {
  const { data: heroData } = db.storage.from('artist').getPublicUrl('hero.jpg');
  const { data: artistData } = db.storage.from('artist').getPublicUrl('artist.jpg');

  const heroImg = document.getElementById('hero-preview-img');
  const artistImg = document.getElementById('artist-preview-img');

  heroImg.src = heroData.publicUrl + '?t=' + Date.now();
  heroImg.onload = () => {
    heroImg.style.display = 'block';
    document.getElementById('hero-preview-placeholder').style.display = 'none';
  };

  artistImg.src = artistData.publicUrl + '?t=' + Date.now();
  artistImg.onload = () => {
    artistImg.style.display = 'block';
    document.getElementById('artist-preview-placeholder').style.display = 'none';
  };
}

async function uploadSiteImage(file, filename, statusId) {
  const status = document.getElementById(statusId);
  status.textContent = 'Загружаем...';

  await db.storage.from('artist').remove([filename]);

  const { error } = await db.storage.from('artist').upload(filename, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    status.textContent = 'Ошибка загрузки';
  } else {
    status.textContent = 'Сохранено!';
    setTimeout(() => status.textContent = '', 2000);
    loadSiteImages();
  }
}

document.getElementById('hero-upload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) uploadSiteImage(file, 'hero.jpg', 'hero-status');
});

document.getElementById('artist-upload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) uploadSiteImage(file, 'artist.jpg', 'artist-status');
});
