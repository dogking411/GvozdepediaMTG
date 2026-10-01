export function toast(message, { error = false, timeout = 5000 } = {}) {
  const el = document.createElement('div');
  el.className = `toast ${error ? 'toast-error' : ''}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('visible'));
  setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 300);
  }, timeout);
}
