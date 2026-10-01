// Всплывающее изображение карты при наведении на любой элемент с data-img
export function initCardPreview(el) {
  let current = null;

  const place = (e) => {
    const w = el.offsetWidth || 250;
    const h = el.offsetHeight || 350;
    let x = e.clientX + 24;
    let y = e.clientY - h / 2;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 24;
    y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
    el.style.transform = `translate(${x}px, ${y}px)`;
  };

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-img]');
    if (target === current) return;
    current = target;
    if (!target || !target.dataset.img || matchMedia('(hover: none)').matches) {
      el.classList.remove('visible');
      return;
    }
    const back = target.dataset.back;
    el.innerHTML = `<img src="${target.dataset.img}" alt="">${back ? `<img src="${back}" alt="">` : ''}`;
    el.classList.toggle('double', Boolean(back));
    el.classList.add('visible');
    place(e);
  });

  document.addEventListener('mousemove', (e) => {
    if (current) place(e);
  });
}
