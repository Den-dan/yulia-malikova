let editingId = null;
const DRAFT_KEY = 'painting_draft';

// ===== ЧЕРНОВИК =====
function saveDraft() {
  const draft = {
    name:     document.getElementById('edit-name').value,
    desc:     document.getElementById('edit-desc').value,
    category: document.getElementById('edit-category').value,
    year:     document.getElementById('edit-year').value,
    width:    document.getElementById('edit-width').value,
    height:   document.getElementById('edit-height').value,
    material: document.getElementById('edit-material').value,
    price:    document.getElementById('edit-price').value,
    featured: document.getElementById('edit-featured').checked,
    available: document.getElementById('edit-available').checked,
    tags:     getSelectedTags(),
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function restoreDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  const d = JSON.parse(raw);
  document.getElementById('edit-name').value      = d.name     || '';
  document.getElementById('edit-desc').value      = d.desc     || '';
  document.getElementById('edit-category').value  = d.category || 'Пейзаж';
  document.getElementById('edit-year').value      = d.year     || '';
  document.getElementById('edit-width').value     = d.width    || '';
  document.getElementById('edit-height').value    = d.height   || '';
  document.getElementById('edit-material').value  = d.material || '';
  document.getElementById('edit-price').value     = d.price    || '';
  document.getElementById('edit-featured').checked = d.featured ?? false;
  document.getElementById('edit-available').checked = d.available ?? true;
  if (d.tags) setSelectedTags(d.tags);
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

// ===== ТЕГИ =====
function getSelectedTags() {
  const result = [];
  document.querySelectorAll('.tag-chips').forEach(group => {
    const category = group.dataset.tag;
    group.querySelectorAll('.chip.active').forEach(chip => {
      result.push({ tag_category: category, tag_value: chip.dataset.value });
    });
  });
  return result;
}

function setSelectedTags(tags) {
  document.querySelectorAll('.tag-chips .chip').forEach(chip => chip.classList.remove('active'));
  tags.forEach(tag => {
    const group = document.querySelector(`.tag-chips[data-tag="${tag.tag_category}"]`);
    if (!group) return;
    const chip = group.querySelector(`.chip[data-value="${tag.tag_value}"]`);
    if (chip) chip.classList.add('active');
  });
}

function initTagChips() {
  document.querySelectorAll('.tag-chips').forEach(group => {
    group.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
        saveDraft();
      });
    });
  });
}

// ===== ПРЕВЬЮ ФОТО =====
// Храним: { file, url, is_cover, existing_id (если уже в БД) }
let pendingPhotos = [];

function renderPreviews() {
  const wrap = document.getElementById('edit-previews');
  wrap.innerHTML = '';
  pendingPhotos.forEach((photo, i) => {
    const div = document.createElement('div');
    div.className = 'edit-preview-item' + (photo.is_cover ? ' is-cover' : '');
    div.title = 'Нажмите чтобы сделать главным';
    div.innerHTML = `
      <img src="${photo.url}" alt="">
      ${photo.is_cover ? '<div class="cover-badge">Главное</div>' : ''}
      <button class="remove-photo" data-index="${i}" title="Удалить">✕</button>
    `;
    div.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-photo')) return;
      pendingPhotos.forEach((p, idx) => p.is_cover = idx === i);
      renderPreviews();
    });
    div.querySelector('.remove-photo').addEventListener('click', (e) => {
      e.stopPropagation();
      pendingPhotos.splice(i, 1);
      if (pendingPhotos.length > 0 && !pendingPhotos.some(p => p.is_cover)) {
        pendingPhotos[0].is_cover = true;
      }
      renderPreviews();
    });
    wrap.appendChild(div);
  });
}

document.getElementById('edit-images').addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  files.forEach((file, i) => {
    const url = URL.createObjectURL(file);
    const is_cover = pendingPhotos.length === 0 && i === 0;
    pendingPhotos.push({ file, url, is_cover, existing_id: null });
  });
  renderPreviews();
  e.target.value = '';
});

// ===== СОСТОЯНИЕ =====
let paintings = [];

async function checkSession() {
  const { data: { session } } = await db.auth.getSession();
  if (session) showAdmin();
}

// ===== ВХОД =====
async function doLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const error_el = document.getElementById('login-error');
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    error_el.textContent = 'Неверный email или пароль';
  } else {
    showAdmin();
  }
}

document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('login-email').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

// ===== ВЫХОД =====
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

// ===== ЗАГРУЗКА КАРТИН =====
async function loadPaintings() {
  const { data, error } = await db
    .from('paintings')
    .select('*, painting_images(*), painting_tags(*)')
    .order('sort_order', { ascending: true });
  if (error) return;
  paintings = data;
  renderPaintings();
}

function getCoverUrl(p) {
  if (p.painting_images && p.painting_images.length > 0) {
    const sorted = [...p.painting_images].sort((a, b) => a.sort_order - b.sort_order);
    const cover = sorted.find(img => img.is_cover) || sorted[0];
    return cover.image_url;
  }
  return p.image_url || '';
}

function renderPaintings() {
  const grid = document.getElementById('admin-grid');
  grid.innerHTML = paintings.map(p => `
    <div class="admin-card">
      <img src="${getCoverUrl(p)}" alt="${p.title}" onerror="this.style.display='none'">
      <div class="admin-card-info">
        <div class="admin-card-order">
          <span class="label">Порядок</span>
          <input type="number" class="order-input" value="${p.sort_order || 0}" min="0"
            onchange="updateOrder('${p.id}', this.value)">
        </div>
        <h3>${p.title}</h3>
        <span class="label">${p.category_type || p.category || ''}</span>
        ${!p.is_visible ? '<span class="hidden-badge">Скрыта</span>' : ''}
        ${!p.is_available ? '<span class="hidden-badge">Продано</span>' : ''}
        <div class="admin-card-actions">
  <button onclick="openEdit('${p.id}')">Изменить</button>
  <button onclick="toggleVisible('${p.id}', ${p.is_visible})">
    ${p.is_visible ? 'Скрыть' : 'Показать'}
  </button>
  <button onclick="toggleAvailable('${p.id}', ${p.is_available})">
    ${p.is_available ? 'Продана' : 'В наличии'}
  </button>
  <button class="danger" onclick="deletePainting('${p.id}')">Удалить</button>
</div>
      </div>
    </div>
  `).join('');
}

// ===== ДОБАВИТЬ =====
document.getElementById('add-btn').addEventListener('click', () => {
  editingId = null;
  pendingPhotos = [];
  document.getElementById('edit-title').textContent = 'Добавить картину';
  document.getElementById('edit-name').value = '';
  document.getElementById('edit-desc').value = '';
  document.getElementById('edit-year').value = '';
  document.getElementById('edit-width').value = '';
  document.getElementById('edit-height').value = '';
  document.getElementById('edit-material').value = '';
  document.getElementById('edit-price').value = '';
  document.getElementById('edit-featured').checked = false;
  document.getElementById('edit-available').checked = true;
  document.getElementById('edit-status').textContent = '';
  document.querySelectorAll('.tag-chips .chip').forEach(c => c.classList.remove('active'));
  renderPreviews();
  restoreDraft();
  document.getElementById('edit-modal').classList.add('open');
});

// ===== РЕДАКТИРОВАТЬ =====
async function openEdit(id) {
  const p = paintings.find(x => x.id === id);
  if (!p) return;
  editingId = id;

  document.getElementById('edit-title').textContent = 'Редактировать';
  document.getElementById('edit-name').value      = p.title || '';
  document.getElementById('edit-desc').value      = p.description || '';
  document.getElementById('edit-category').value  = p.category_type || p.category || 'Пейзаж';
  document.getElementById('edit-year').value      = p.year || '';
  document.getElementById('edit-width').value     = p.width_cm || '';
  document.getElementById('edit-height').value    = p.height_cm || '';
  document.getElementById('edit-material').value  = p.material || '';
  document.getElementById('edit-price').value     = p.price || '';
  document.getElementById('edit-featured').checked = p.is_featured;
  document.getElementById('edit-available').checked = p.is_available ?? true;
  document.getElementById('edit-status').textContent = '';

  // Теги
  const tags = (p.painting_tags || []).map(t => ({ tag_category: t.tag_category, tag_value: t.tag_value }));
  setSelectedTags(tags);

  // Существующие фото
  pendingPhotos = [];
  if (p.painting_images && p.painting_images.length > 0) {
    const sorted = [...p.painting_images].sort((a, b) => a.sort_order - b.sort_order);
    sorted.forEach(img => {
      pendingPhotos.push({ file: null, url: img.image_url, is_cover: img.is_cover, existing_id: img.id });
    });
  } else if (p.image_url) {
    pendingPhotos.push({ file: null, url: p.image_url, is_cover: true, existing_id: null });
  }

  renderPreviews();
  document.getElementById('edit-modal').classList.add('open');
}

// ===== СОХРАНИТЬ =====
document.getElementById('edit-save').addEventListener('click', async () => {
  const status = document.getElementById('edit-status');
  const title = document.getElementById('edit-name').value.trim();
  if (!title) { status.textContent = 'Введите название'; return; }
  if (pendingPhotos.length === 0) { status.textContent = 'Добавьте хотя бы одно фото'; return; }

  status.textContent = 'Сохраняем...';

  // 1. Сохраняем основные данные картины
  const payload = {
    title,
    description: document.getElementById('edit-desc').value,
    category_type: document.getElementById('edit-category').value,
    year: parseInt(document.getElementById('edit-year').value) || null,
    width_cm: parseFloat(document.getElementById('edit-width').value) || null,
    height_cm: parseFloat(document.getElementById('edit-height').value) || null,
    material: document.getElementById('edit-material').value,
    price: parseFloat(document.getElementById('edit-price').value) || null,
    is_visible: true,
    is_featured: document.getElementById('edit-featured').checked,
    is_available: document.getElementById('edit-available').checked,
  };

  let paintingId = editingId;

  if (editingId) {
    const { error } = await db.from('paintings').update(payload).eq('id', editingId);
    if (error) { status.textContent = 'Ошибка: ' + error.message; return; }
  } else {
    const { data, error } = await db.from('paintings').insert(payload).select().single();
    if (error) { status.textContent = 'Ошибка: ' + error.message; return; }
    paintingId = data.id;
  }

  // 2. Загружаем новые фото и обновляем painting_images
  if (editingId) {
    // Удаляем фото которые убрали
    const existingIds = pendingPhotos.filter(p => p.existing_id).map(p => p.existing_id);
    const { data: oldImages } = await db.from('painting_images').select('id').eq('painting_id', editingId);
    if (oldImages) {
      const toDelete = oldImages.filter(img => !existingIds.includes(img.id)).map(img => img.id);
      if (toDelete.length > 0) {
        await db.from('painting_images').delete().in('id', toDelete);
      }
    }
  }

  // Загружаем новые файлы
  for (let i = 0; i < pendingPhotos.length; i++) {
    const photo = pendingPhotos[i];
    if (photo.file) {
      const newPhotos = pendingPhotos.filter(p => p.file);
const newIndex = newPhotos.indexOf(photo) + 1;
status.textContent = `Загружаем фото ${newIndex} из ${newPhotos.length}...`;
      const ext = photo.file.name.split('.').pop();
      const filename = `${paintingId}/${Date.now()}_${i}.${ext}`;
      const { error: uploadError } = await db.storage.from('paintings').upload(filename, photo.file);
      if (uploadError) { status.textContent = 'Ошибка загрузки фото'; return; }
      const { data: urlData } = db.storage.from('paintings').getPublicUrl(filename);
      photo.url = urlData.publicUrl;
      photo.existing_id = null;
    }
  }

  // Пересохраняем все фото в painting_images
  if (editingId) {
    await db.from('painting_images').delete().eq('painting_id', paintingId);
  }

  const imageRows = pendingPhotos.map((photo, i) => ({
    painting_id: paintingId,
    image_url: photo.url,
    sort_order: i,
    is_cover: photo.is_cover,
  }));

  const { error: imgError } = await db.from('painting_images').insert(imageRows);
  if (imgError) { status.textContent = 'Ошибка сохранения фото'; return; }

  // Первое фото также в image_url для обратной совместимости
  const coverPhoto = pendingPhotos.find(p => p.is_cover) || pendingPhotos[0];
  await db.from('paintings').update({ image_url: coverPhoto.url }).eq('id', paintingId);

  // 3. Сохраняем теги
  await db.from('painting_tags').delete().eq('painting_id', paintingId);
  const tags = getSelectedTags();
  if (tags.length > 0) {
    const tagRows = tags.map(t => ({ painting_id: paintingId, ...t }));
    await db.from('painting_tags').insert(tagRows);
  }

  status.textContent = 'Сохранено!';
  setTimeout(() => {
    closeEditModal();
    clearDraft();
    loadPaintings();
  }, 800);
});

// ===== ВСПОМОГАТЕЛЬНЫЕ =====
async function updateOrder(id, value) {
  await db.from('paintings').update({ sort_order: parseInt(value) || 0 }).eq('id', id);
  const { data } = await db.from('paintings').select('*, painting_images(*), painting_tags(*)').order('sort_order', { ascending: true });
  if (data) { paintings = data; renderPaintings(); }
}

async function toggleVisible(id, current) {
  await db.from('paintings').update({ is_visible: !current }).eq('id', id);
  loadPaintings();
}

async function toggleAvailable(id, current) {
  await db.from('paintings').update({ is_available: !current }).eq('id', id);
  loadPaintings();
}

async function deletePainting(id) {
  if (!confirm('Удалить картину?')) return;
  await db.from('painting_images').delete().eq('painting_id', id);
  await db.from('painting_tags').delete().eq('painting_id', id);
  await db.from('paintings').delete().eq('id', id);
  loadPaintings();
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open');
  document.getElementById('edit-images').value = '';
  pendingPhotos = [];
}

document.getElementById('edit-cancel').onclick = closeEditModal;
document.getElementById('edit-overlay').onclick = closeEditModal;

// ===== ЧЕРНОВИК: подписка на изменения =====
['edit-name','edit-desc','edit-category','edit-year','edit-width','edit-height','edit-material','edit-price'].forEach(id => {
  document.getElementById(id).addEventListener('input', saveDraft);
});
['edit-featured','edit-available'].forEach(id => {
  document.getElementById(id).addEventListener('change', saveDraft);
});

initTagChips();
checkSession();

// ===== НАСТРОЙКИ САЙТА =====
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
  const { error } = await db.storage.from('artist').upload(filename, file, { upsert: true, contentType: file.type });
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