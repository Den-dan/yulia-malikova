async function loadFeaturedPaintings() {
  const grid = document.getElementById('works-grid');
  if (!grid) return;

  const { data, error } = await db
    .from('paintings')
    .select('*')
    .eq('is_featured', true)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })
    .limit(4);

  if (error || !data || data.length === 0) {
    grid.innerHTML = '<p style="color:var(--brown)">Работы скоро появятся</p>';
    return;
  }

  grid.innerHTML = data.map(p => `
    <div class="painting-card">
      <img src="${p.image_url}" alt="${p.title}">
      <span class="card-label">${p.category || 'Акварель'}</span>
    </div>
  `).join('');
}

loadFeaturedPaintings();

const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('form-status');
    status.textContent = 'Отправляем...';

    const { error } = await db.from('messages').insert({
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      subject: document.getElementById('subject').value,
      message: document.getElementById('message').value,
    });

    if (error) {
      status.textContent = 'Ошибка. Попробуйте ещё раз.';
    } else {
      status.textContent = 'Сообщение отправлено! Отвечу в течение дня.';
      contactForm.reset();
    }
  });
}

async function loadSiteImages() {
  const { data: heroData } = db.storage.from('artist').getPublicUrl('hero.jpg');
  const { data: artistData } = db.storage.from('artist').getPublicUrl('artist.jpg');

  const heroWrap = document.querySelector('.hero-image');
  if (heroWrap) {
    heroWrap.innerHTML = `<img src="${heroData.publicUrl}?t=${Date.now()}" alt="Картина художника" style="width:100%;height:100%;object-fit:cover;border-radius:4px">`;
  }

  const artistWrap = document.querySelector('.about-preview-image');
  if (artistWrap) {
    artistWrap.innerHTML = `<img src="${artistData.publicUrl}?t=${Date.now()}" alt="Юлия Маликова" style="width:100%;height:100%;object-fit:cover;border-radius:4px">`;
  }
}

loadSiteImages();
