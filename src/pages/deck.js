import { marked } from 'marked';
import { findDeck } from '../lib/content.js';
import { isEditor } from '../lib/auth.js';
import { fetchCards, lookup, manaSymbols } from '../lib/scryfall.js';
import { esc } from '../lib/html.js';
import { renderDecklist } from '../components/decklist.js';
import { computeStats, renderStats } from '../components/stats.js';
import { notFound } from './misc.js';

const VIEW_KEY = 'gvozd:decklist-view';
const getView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) || 'list';
  } catch {
    return 'list';
  }
};
const setView = (v) => {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* без запоминания */
  }
};

export function deckPage(el, slug, isCurrent) {
  const deck = findDeck(slug);
  if (!deck) return notFound(el);
  document.title = `${deck.name} — GvozdepediaMTG`;

  el.innerHTML = `
    <article class="deck-page">
      <div class="deck-main">
        <header class="deck-head panel">
          <div class="commanders" id="commanders">
            ${deck.commanders.map(() => '<div class="commander-img skeleton"></div>').join('') || '<div class="commander-img skeleton"></div>'}
          </div>
          <div class="deck-intro">
            <p class="eyebrow">Колода · Commander</p>
            <h1>${esc(deck.name)}</h1>
            <p class="commander-names" id="commander-names">${deck.commanders.map(esc).join(' + ')}</p>
            ${deck.primer ? `<div class="prose primer">${marked.parse(deck.primer)}</div>` : ''}
            <div class="deck-actions">
              ${deck.moxfield ? `<a class="btn btn-primary" href="${esc(deck.moxfield)}" target="_blank" rel="noopener">Открыть на Moxfield ↗</a>` : ''}
              <button class="btn" id="copy-list">Скопировать список</button>
              ${isEditor() ? `<a class="btn" href="#/decks/${deck.slug}/edit">✎ Редактировать</a>` : ''}
            </div>
          </div>
        </header>

        <section class="panel decklist-panel">
          <div class="panel-head">
            <h2>Деклист</h2>
            <div class="segmented" role="group" aria-label="Вид деклиста">
              <button data-view="list">Списком</button>
              <button data-view="grid">Картинками</button>
            </div>
          </div>
          <div id="decklist"><p class="muted loading">Загружаю карты со Scryfall…</p></div>
        </section>
      </div>

      <aside class="deck-side">
        <section class="panel">
          <h2>Мысли о колоде</h2>
          <div class="prose">${deck.thoughts ? marked.parse(deck.thoughts) : '<p class="muted">Пока пусто.</p>'}</div>
        </section>
        <section class="panel stats-panel">
          <h2>Статистика</h2>
          <div id="stats"><p class="muted loading">Считаю…</p></div>
        </section>
      </aside>
    </article>
  `;

  el.querySelector('#copy-list').addEventListener('click', async (e) => {
    const text = [...deck.commanders.map((c) => `1 ${c}`), ...deck.cards.map((c) => `${c.qty} ${c.name}`)].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      e.target.textContent = 'Скопировано ✓';
    } catch {
      e.target.textContent = 'Не удалось скопировать';
    }
    setTimeout(() => (e.target.textContent = 'Скопировать список'), 2000);
  });

  load(el, deck, isCurrent);
}

async function load(el, deck, isCurrent) {
  let map;
  try {
    map = await fetchCards([...deck.commanders, ...deck.cards.map((c) => c.name)]);
  } catch (err) {
    if (!isCurrent()) return;
    el.querySelector('#decklist').innerHTML = `<p class="error">Не удалось загрузить карты: ${esc(err.message)}</p>`;
    el.querySelector('#stats').innerHTML = '';
    return;
  }
  if (!isCurrent()) return;

  const commanderCards = deck.commanders.map((name) => lookup(map, name)).filter(Boolean);
  el.querySelector('#commanders').innerHTML = commanderCards.length
    ? commanderCards
        .map(
          (c) => `
          <a class="commander-img" href="${esc(c.url)}" target="_blank" rel="noopener" ${c.backImage ? `data-img="${esc(c.image)}" data-back="${esc(c.backImage)}"` : ''}>
            <img src="${esc(c.image)}" alt="${esc(c.name)}">
          </a>`,
        )
        .join('')
    : '<div class="commander-img empty">?</div>';
  el.querySelector('#commander-names').innerHTML = commanderCards
    .map((c) => `${esc(c.name)} <span class="cost">${manaSymbols(c.manaCost)}</span>`)
    .join(' + ');

  const entries = deck.cards.map((c) => ({ ...c, card: lookup(map, c.name) }));

  const listEl = el.querySelector('#decklist');
  const buttons = el.querySelectorAll('.segmented button');
  const show = (view) => {
    listEl.innerHTML = renderDecklist(entries, view);
    buttons.forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  };
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      setView(b.dataset.view);
      show(b.dataset.view);
    }),
  );
  show(getView());

  el.querySelector('#stats').innerHTML = renderStats(computeStats(entries, commanderCards));
}
