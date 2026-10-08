import { getDecks } from '../lib/content.js';
import { isEditor } from '../lib/auth.js';
import { fetchCards, lookup, manaSymbols } from '../lib/scryfall.js';
import { esc } from '../lib/html.js';
import { renderCoolStrip } from './coolCards.js';

function deckTiles(el, isCurrent) {
  const decks = getDecks();
  const grid = el.querySelector('.deck-grid');
  if (!decks.length) {
    grid.innerHTML = '<p class="muted">Колод пока нет.</p>';
    return;
  }
  grid.innerHTML = decks
    .map(
      (d) => `
      <a class="deck-tile" href="#/decks/${d.slug}" data-slug="${d.slug}">
        <div class="deck-tile-art skeleton"></div>
        <div class="deck-tile-body">
          <h3>${esc(d.name)}</h3>
          <p class="muted">${d.commanders.map(esc).join(' + ')}</p>
        </div>
      </a>`,
    )
    .join('');

  fetchCards(decks.flatMap((d) => d.commanders))
    .then((map) => {
      if (!isCurrent()) return;
      for (const d of decks) {
        const cards = d.commanders.map((n) => lookup(map, n)).filter(Boolean);
        const tile = grid.querySelector(`[data-slug="${d.slug}"]`);
        if (!cards.length) continue;
        const art = tile.querySelector('.deck-tile-art');
        art.classList.remove('skeleton');
        art.style.backgroundImage = cards.map((c) => `url("${c.art}")`).join(', ');
        if (cards.length > 1) art.classList.add('partners');
        const ids = [...new Set(cards.flatMap((c) => c.colorIdentity))];
        tile.querySelector('.deck-tile-body').insertAdjacentHTML(
          'beforeend',
          `<div class="identity">${ids.length ? manaSymbols(ids.map((c) => `{${c}}`).join('')) : manaSymbols('{C}')}</div>`,
        );
      }
    })
    .catch(() => {});
}

export function homePage(el, isCurrent) {
  document.title = 'GvozdepediaMTG';
  el.innerHTML = `
    <section class="hero">
      <p class="eyebrow">Энциклопедия моего мира Magic: The Gathering</p>
      <h1 class="hero-title">Gvozdepedia<span>MTG</span></h1>
      <p class="hero-lead">Мои колоды для Commander, мысли о них, гайды, новости и турниры по EDH — всё в одном месте.</p>
    </section>
    <section>
      <div class="section-head"><h2>Колоды</h2><a href="#/decks" class="muted">Все колоды →</a></div>
      <div class="deck-grid"></div>
    </section>
    <section class="home-section">
      <div class="section-head"><h2>Крутые карты</h2><a href="#/cards" class="muted">Все карты →</a></div>
      <div class="cool-strip"></div>
    </section>
  `;
  deckTiles(el, isCurrent);
  renderCoolStrip(el.querySelector('.cool-strip'), isCurrent);
}

export function decksPage(el, isCurrent) {
  document.title = 'Колоды — GvozdepediaMTG';
  el.innerHTML = `
    <div class="section-head">
      <h1>Колоды <span class="muted">${getDecks().length}</span></h1>
      ${isEditor() ? '<a class="btn btn-primary" href="#/decks/new">+ Новая колода</a>' : ''}
    </div>
    <div class="deck-grid"></div>
  `;
  deckTiles(el, isCurrent);
}

export function comingSoon(el, title) {
  document.title = `${title} — GvozdepediaMTG`;
  el.innerHTML = `
    <div class="empty-state">
      <h1>${esc(title)}</h1>
      <p class="muted">Раздел в разработке — скоро здесь что-то появится.</p>
    </div>`;
}

export function notFound(el) {
  document.title = 'Не найдено — GvozdepediaMTG';
  el.innerHTML = `
    <div class="empty-state">
      <h1>Страница не найдена</h1>
      <p><a href="#/">На главную</a></p>
    </div>`;
}
