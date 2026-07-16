(() => {
  const menuToggle = document.querySelector('.menu-toggle');
  const siteNav = document.querySelector('.site-nav');
  const tennisBall = document.querySelector('.tennis-ball');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (menuToggle && siteNav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = siteNav.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  if (!tennisBall || prefersReducedMotion) {
    return;
  }

  const ballSize = 56;

  function randomPosition() {
    const width = Math.max(window.innerWidth - ballSize - 24, 24);
    const height = Math.max(window.innerHeight - ballSize - 24, 24);
    return {
      x: 12 + Math.random() * width,
      y: 12 + Math.random() * height,
      rotate: Math.random() * 360,
      duration: 1400 + Math.random() * 1400,
    };
  }

  function moveBall() {
    const position = randomPosition();
    tennisBall.style.setProperty('--ball-x', `${position.x}px`);
    tennisBall.style.setProperty('--ball-y', `${position.y}px`);
    tennisBall.style.setProperty('--ball-rotate', `${position.rotate}deg`);
    tennisBall.style.setProperty('--ball-duration', `${position.duration}ms`);
  }

  tennisBall.style.opacity = '1';
  moveBall();
  window.setInterval(moveBall, 2200);
})();
