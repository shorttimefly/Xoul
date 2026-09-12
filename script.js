const header = document.querySelector('.site-header');
const hero = document.querySelector('.hero');
const glow = document.querySelector('.ambient-glow');

if (glow && window.matchMedia('(pointer: fine)').matches) {
  window.addEventListener('pointermove', (event) => {
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  }, { passive: true });
}

const revealItems = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries, currentObserver) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      currentObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
revealItems.forEach((item) => observer.observe(item));

const updateScrollState = () => {
  const y = window.scrollY;
  header?.classList.toggle('scrolled', y > 18);
  hero?.classList.toggle('scrolled-away', y > window.innerHeight * 0.45);
};
window.addEventListener('scroll', updateScrollState, { passive: true });
updateScrollState();
