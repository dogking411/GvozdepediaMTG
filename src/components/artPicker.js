import { printingsOf } from '../lib/scryfall.js';
import { esc } from '../lib/html.js';

/** Сетка всех печатей карты; onSelect(card) — выбранная печать. */
export async function mountArtPicker(container, card, onSelect) {
  container.innerHTML = '<p class="muted">Загружаю все версии карты…</p>';
  let prints;
  try {
    ({ cards: prints } = await printingsOf(card));
  } catch (err) {
    container.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    return;
  }
  const withImages = prints.filter((p) => p.image);
  if (withImages.length <= 1) {
    container.innerHTML = '<p class="muted">У этой карты только один арт.</p>';
    return;
  }
  container.innerHTML = `
    <p class="muted">Версий: ${withImages.length}. Нажми на нужную.</p>
    <div class="card-grid art-grid">
      ${withImages
        .map(
          (p, i) => `
          <button type="button" class="card-tile ${p.id === card.id ? 'selected' : ''}" data-i="${i}"
            title="${esc([p.flavorName, p.setName, `#${p.number}`].filter(Boolean).join(' · '))}">
            <img src="${esc(p.image)}" alt="${esc(p.flavorName || p.name)}" loading="lazy">
          </button>`,
        )
        .join('')}
    </div>`;
  container.querySelectorAll('.card-tile').forEach((b) =>
    b.addEventListener('click', () => onSelect(withImages[Number(b.dataset.i)])),
  );
}
