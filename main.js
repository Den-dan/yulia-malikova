function isSold(painting) {
  return painting.is_available === false || String(painting.is_available) === 'false';
}

async function loadFeaturedPaintings() {
  const grid = document.getElementById('works-grid');
  if (!grid) return;
  grid.innerHTML = Array(4).fill(`
    <div class="painting-card loading" style="aspect-ratio:3/4"></div>
  `).join('');

  const { data, error } = await db
    .from('paintings')
    .select('id, title, category_type, category, image_url, painting_images(image_url, is_cover, sort_order)')
    .eq('is_featured', true)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })
    .limit(8);

  if (error || !data || data.length === 0) {
    grid.innerHTML = '<p style="color:var(--brown)">Работы скоро появятся</p>';
    return;
  }

  grid.innerHTML = data.map(p => {
    let cover = p.image_url || '';
    if (p.painting_images && p.painting_images.length > 0) {
      const sorted = [...p.painting_images].sort((a, b) => a.sort_order - b.sort_order);
      const coverImg = sorted.find(img => img.is_cover);
      cover = (coverImg || sorted[0]).image_url;
    }
    return `
    <a class="painting-card${isSold(p) ? ' is-sold' : ''}" href="gallery.html?painting=${p.id}">
      <img src="${cover}" alt="${p.title}" onload="this.classList.add('loaded')">
      ${isSold(p) ? '<span class="sold-badge">Продано</span>' : ''}
      <div class="card-overlay">
        <span class="card-title">${p.title}</span>
        <span class="card-label">${p.category_type || p.category || 'Акварель'}</span>
      </div>
    </a>
  `;
  }).join('');
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

  const heroBannerImg = document.getElementById('hero-banner-img');
  if (heroBannerImg) {
    heroBannerImg.src = heroData.publicUrl;
  }

  const artistHeroWrap = document.querySelector('.about-hero-image');
  if (artistHeroWrap) {
    artistHeroWrap.classList.add('img-loading-wrap');
    artistHeroWrap.innerHTML = `<img src="${artistData.publicUrl}" alt="Юлия Маликова" style="width:100%;height:auto;display:block;" onload="this.classList.add('loaded')">`;
  }
}
loadSiteImages();

// ===== ПРЕЛОАДЕР =====
window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  if (!preloader) return;

  if (sessionStorage.getItem('visited')) {
    preloader.remove();
    return;
  }

  sessionStorage.setItem('visited', '1');
  document.body.style.overflow = 'hidden';

  const text = 'YanArt';
  const container = document.getElementById('preloader-text');
  const line = document.getElementById('preloader-line');

  [...text].forEach((char, i) => {
    const span = document.createElement('span');
    span.className = 'preloader-char';
    span.setAttribute('data-char', char);
    span.textContent = char === ' ' ? '\u00A0' : char;
    span.style.setProperty('--char-delay', `${i * 0.12}s`);
    container.appendChild(span);
  });

  setTimeout(() => line.classList.add('grow'), 100);

  setTimeout(() => {
    document.body.style.overflow = '';
    preloader.classList.add('hide');
    setTimeout(() => preloader.remove(), 800);
  }, 2000);
});