/**
 * Photo carousel for the welcome page.
 *
 * The slides are plain <img class="carousel-slide"> elements in the HTML; this
 * adds the dots and the pause button, and changes the photo every few seconds.
 * It stops while the pointer is over it, while it has keyboard focus, while the
 * tab is hidden, or when the visitor pauses it. With reduced motion requested,
 * it starts paused and the fade is turned off in CSS.
 */

/** Index of the slide after `index`, wrapping around. */
export function nextIndex(index, count, step = 1) {
  return (((index + step) % count) + count) % count;
}

/**
 * @param {HTMLElement} root The .carousel element.
 * @param {Function} t Translator from createTranslator().
 * @param {object} [options]
 * @param {number} [options.interval=6000] Milliseconds per photo.
 * @param {boolean} [options.autoplay=true]
 */
export function setupCarousel(root, t, { interval = 6000, autoplay = true } = {}) {
  const slides = [...root.querySelectorAll('.carousel-slide')];
  const dotsBox = root.querySelector('.carousel-dots');
  const toggle = root.querySelector('.carousel-toggle');
  if (slides.length < 2) return;

  let current = 0;
  let timer = null;
  const paused = { user: !autoplay, hover: false, focus: false };

  const dots = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.setAttribute('aria-label', t('home.carousel.goTo', { n: i + 1, total: slides.length }));
    dot.addEventListener('click', () => {
      show(i);
      restart();
    });
    return dot;
  });
  dotsBox.replaceChildren(...dots);

  function show(index) {
    current = index;
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active);
      // Only the visible photo is read out, as the link's name.
      slide.setAttribute('aria-hidden', String(!active));
    });
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
  }

  const running = () => !paused.user && !paused.hover && !paused.focus && !document.hidden;
  function restart() {
    clearInterval(timer);
    timer = running() ? setInterval(() => show(nextIndex(current, slides.length)), interval) : null;
  }

  function renderToggle() {
    toggle.textContent = t(paused.user ? 'home.carousel.play' : 'home.carousel.pause');
    toggle.setAttribute('aria-pressed', String(paused.user));
  }
  toggle.addEventListener('click', () => {
    paused.user = !paused.user;
    renderToggle();
    restart();
  });

  const hold = (key, value) => () => {
    paused[key] = value;
    restart();
  };
  root.addEventListener('pointerenter', hold('hover', true));
  root.addEventListener('pointerleave', hold('hover', false));
  root.addEventListener('focusin', hold('focus', true));
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget)) hold('focus', false)();
  });
  document.addEventListener('visibilitychange', restart);

  show(0);
  renderToggle();
  restart();
}
