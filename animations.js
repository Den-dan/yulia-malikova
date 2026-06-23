// ===== FADE-IN ПРИ ЗАГРУЗКЕ =====
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 0.4s ease';
document.addEventListener('DOMContentLoaded', () => {
  document.body.style.opacity = '1';
});

// ===== ПОЯВЛЕНИЕ ПРИ СКРОЛЛЕ =====
window.addEventListener('DOMContentLoaded', () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

document.querySelectorAll('.hero, .works, .about-preview, .contacts-cards, .about-hero-text, .about-details, .about-quote, .gallery-header, .gallery-filters, .painting-card, .contact-card').forEach(el => {
    el.classList.add('fade-up');
    observer.observe(el);
  });
});

// ===== БУРГЕР-МЕНЮ =====
const burger = document.getElementById('burger');
const nav = document.getElementById('main-nav');

if (burger && nav) {
  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    nav.classList.toggle('open');
    document.body.style.overflow = nav.classList.contains('open') ? 'hidden' : '';
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      burger.classList.remove('open');
      nav.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}