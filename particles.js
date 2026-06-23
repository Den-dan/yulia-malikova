(function () {
  function init() {
    const banner = document.querySelector('.hero-banner');
    if (!banner) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
    banner.style.position = 'relative';
    banner.insertBefore(canvas, banner.firstChild);

    const img = banner.querySelector('img');
    if (img) {
      img.style.position = 'relative';
      img.style.zIndex = '1';
    }

    const ctx = canvas.getContext('2d');

    const PALETTE = [
      [232, 160, 180],
      [242, 192, 206],
      [212, 184, 150],
      [200, 168, 112],
      [237, 213, 184],
      [245, 214, 200],
      [222, 196, 160],
      [255, 220, 150],
      [248, 200, 120],
    ];

    let W, H, particles;
    let isVisible = true;
    let rafId = null;
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const isLowEnd = navigator.hardwareConcurrency <= 4 || isMobile;
    const PARTICLE_COUNT = isLowEnd ? 80 : 200;
    const MAX_RADIUS = isLowEnd ? 3.5 : 5.0;
    let mouseX = -9999, mouseY = -9999;

    function resize() {
      W = canvas.width  = banner.offsetWidth;
      H = canvas.height = banner.offsetHeight;
    }

    function randColor() {
      return Math.floor(Math.random() * PALETTE.length);
    }

    function createParticle(fromBottom) {
      const ci  = randColor();
      const ci2 = (ci + 1 + Math.floor(Math.random() * (PALETTE.length - 1))) % PALETTE.length;
      const depth = 0.3 + Math.random() * 0.7;
      const vy  = -(0.8 + Math.random() * 1.4) * depth;
      const estimatedLife = H / Math.abs(vy) + 60;
      return {
        x:          Math.random() * W,
        y:          fromBottom ? H + Math.random() * 40 : Math.random() * H,
        r: (1.0 + Math.random() * MAX_RADIUS) * depth,
        depth,
        ci,
        ci2,
        colorPhase: Math.random() * Math.PI * 2,
        colorFreq:  0.004 + Math.random() * 0.006,
        vx:         (Math.random() - 0.5) * 0.6,
        vy,
        opacity:    0.6 + Math.random() * 0.4,
        opPhase:    Math.random() * Math.PI * 2,
        opFreq:     0.008 + Math.random() * 0.006,
        phase:      Math.random() * Math.PI * 2,
        freq:       0.012 + Math.random() * 0.010,
        amp:        0.5 + Math.random() * 1.0,
        life:       0,
        maxLife:    estimatedLife,
        flashAt:    Math.random() < 0.2 ? Math.floor(estimatedLife * (0.4 + Math.random() * 0.2)) : -1,
      };
    }

    function lerpColor(a, b, t) {
      return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
      ];
    }

    function build() {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(createParticle(false));
    }

    function draw() {
      if (!isVisible) {
        rafId = null;
        return;
      }

      ctx.clearRect(0, 0, W, H);

      particles.forEach(p => {
        p.phase      += p.freq;
        p.colorPhase += p.colorFreq;
        p.opPhase    += p.opFreq;
        p.life++;

        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const repel = dist < 100 && dist > 0 ? (100 - dist) / 100 * 2.0 * p.depth : 0;

        p.x += p.vx + Math.sin(p.phase) * p.amp + (repel > 0 ? (dx / dist) * repel : 0);
        p.y += p.vy + (repel > 0 ? (dy / dist) * repel : 0);

        if (p.y < -8 || p.life > p.maxLife) {
          Object.assign(p, createParticle(true));
          return;
        }

        const t = (Math.sin(p.colorPhase) + 1) / 2;
        const [r, g, b] = lerpColor(PALETTE[p.ci], PALETTE[p.ci2], t);

        const fadeIn  = Math.min(1, p.life / 30);
        const fadeOut = Math.min(1, (p.maxLife - p.life) / 30);
        const pulse   = 0.8 + 0.2 * Math.sin(p.opPhase);
        const flash   = p.life === p.flashAt ? 3.0 : 1;
        const alpha   = Math.min(1, p.opacity * fadeIn * fadeOut * pulse * flash);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.globalAlpha = alpha;
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(draw);
    }

    function startLoop() {
      if (rafId === null) {
        rafId = requestAnimationFrame(draw);
      }
    }

    resize();
    build();
    startLoop();

    banner.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    });
    banner.addEventListener('mouseleave', () => { mouseX = -9999; mouseY = -9999; });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { resize(); build(); }, 150);
    });

    const visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
        if (isVisible) startLoop();
      });
    }, { threshold: 0 });

    visibilityObserver.observe(banner);

    document.addEventListener('visibilitychange', () => {
      isVisible = isVisible && !document.hidden;
      if (!document.hidden && banner.getBoundingClientRect().bottom > 0 && banner.getBoundingClientRect().top < window.innerHeight) {
        isVisible = true;
        startLoop();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();