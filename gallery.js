let allPaintings = [];
let currentIndex = 0;
let filtered = [];

async function loadGallery(category = 'all') {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  if (allPaintings.length === 0) {
    const { data, error } = await db
      .from('paintings')
      .select('*')
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (error || !data) {
      grid.innerHTML = '<p style="color:var(--brown);padding:20px">Работы скоро появятся</p>';
      return;
    }
    allPaintings = data;
  }

  filtered = category === 'all'
    ? allPaintings
    : allPaintings.filter(p => p.category === category);

  grid.innerHTML = filtered.map((p, i) => `
    <div class="painting-card" data-index="${i}" onclick="openModal(${i})">
      <img src="${p.image_url}" alt="${p.title}">
      <span class="card-label">${p.category || 'Акварель'}</span>
    </div>
  `).join('');
}

function openModal(index) {
  currentIndex = index;
  const p = filtered[index];
  document.getElementById('modal-img').src = p.image_url;
  document.getElementById('modal-title').textContent = p.title;
  document.getElementById('modal-category').textContent = p.category || '';
  document.getElementById('modal-desc').textContent = p.description || '';
  document.getElementById('modal-size').textContent = p.size ? `Размер: ${p.size}` : '';
  document.getElementById('modal-material').textContent = p.material ? `Материал: ${p.material}` : '';
  document.getElementById('modal-year').textContent = p.year ? `Год: ${p.year}` : '';
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('modal-close').onclick = closeModal;
document.getElementById('modal-overlay').onclick = closeModal;

document.getElementById('modal-prev').onclick = () => {
  currentIndex = (currentIndex - 1 + filtered.length) % filtered.length;
  openModal(currentIndex);
};

document.getElementById('modal-next').onclick = () => {
  currentIndex = (currentIndex + 1) % filtered.length;
  openModal(currentIndex);
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'ArrowLeft') document.getElementById('modal-prev').click();
  if (e.key === 'ArrowRight') document.getElementById('modal-next').click();
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadGallery(btn.dataset.category);
  });
});

loadGallery();