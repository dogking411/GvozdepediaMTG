import { getCoolCards } from '../lib/content.js';
import { isEditor } from '../lib/auth.js';
import { updateCoolCards, sameCard, today } from '../lib/coolCards.js';
import { fetchCards, lookup, manaSymbols } from '../lib/scryfall.js';
import { explainError } from '../lib/github.js';
import { esc } from '../lib/html.js';
import { mountCardSearch } from '../components/cardSearch.js';
import { openCardDialog } from '../components/cardDialog.js';
import { toast } from '../components/toast.js';

const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'];

const SORTS = {
  added: { label: 'Сначала новые', fn: (a, b) => (b.entry.added || '').localeCompare(a.entry.added || '') || b.i - a.i },
  name: { label: 'По названию', fn: (a, b) => a.entry.name.localeCompare(b.entry.name) },
  cmc: { label: 'По мана-стоимости', fn: (a, b) => (a.card?.cmc ?? 0) - (b.card?.cmc ?? 0) },
};

const githubError = (err) => new Error(err.status ? explainError(err) : err.message);

export function coolCardsPage(el, isCurrent) {
  document.title = 'Крутые карты — GvozdepediaMTG';
  const editor = isEditor();
  const state = { query: '', colors: new Set(), sort: 'added' };
  let cardMap = new Map();

  el.innerHTML = `
    <div class="section-head">
      <h1>Крутые карты <span class="muted" id="cool-count"></span></h1>
    </div>
    <p class="page-lead muted">Карты, которые мне нравятся и которые не хочется забыть.</p>

    ${
      editor
        ? `<section class="panel add-panel">
            <h2>Добавить карту</h2>
            <div id="card-search"></div>
            <div id="pick"></div>
          </section>`
        : ''
    }

    <div class="toolbar">
      <input class="filter-input" type="search" placeholder="Фильтр по названию или заметке" aria-label="Фильтр">
      <div class="color-filter" role="group" aria-label="Фильтр по цвету">
        ${COLORS.map((c) => `<button type="button" data-color="${c}" aria-pressed="false" title="${c === 'C' ? 'Бесцветные' : c}">${manaSymbols(`{${c}}`)}</button>`).join('')}
      </div>
      <select class="sort-select" aria-label="Сортировка">
        ${Object.entries(SORTS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}
      </select>
    </div>

    <div class="cool-grid" id="cool-grid"></div>
  `;

  const grid = el.querySelector('#cool-grid');

  function renderGrid() {
    const entries = getCoolCards();
    el.querySelector('#cool-count').textContent = entries.length;
    const q = state.query.toLowerCase();
    const items = entries
      .map((entry, i) => ({ entry, i, card: lookup(cardMap, entry.name) }))
      .filter(({ entry }) => !q || entry.name.toLowerCase().includes(q) || (entry.note || '').toLowerCase().includes(q))
      .filter(({ card }) => {
        if (!state.colors.size) return true;
        const identity = card?.colorIdentity || [];
        return [...state.colors].some((c) => (c === 'C' ? identity.length === 0 : identity.includes(c)));
      })
      .sort(SORTS[state.sort].fn);

    if (!entries.length) {
      grid.innerHTML = `<p class="muted">Пока пусто${editor ? ' — найди карту выше и добавь её.' : '.'}</p>`;
      return;
    }
    if (!items.length) {
      grid.innerHTML = '<p class="muted">Под фильтр ничего не подходит.</p>';
      return;
    }
    grid.innerHTML = items
      .map(
        ({ entry, card }) => `
        <button type="button" class="cool-tile" data-name="${esc(entry.name)}">
          ${card?.image ? `<img src="${esc(card.image)}" alt="${esc(entry.name)}" loading="lazy">` : `<div class="cool-tile-missing">${esc(entry.name)}</div>`}
          ${entry.note ? `<span class="cool-note">${esc(entry.note)}</span>` : ''}
        </button>`,
      )
      .join('');
  }

  async function loadCards() {
    grid.innerHTML = '<p class="muted">Загружаю карты со Scryfall…</p>';
    try {
      cardMap = await fetchCards(getCoolCards().map((e) => e.name));
    } catch (err) {
      if (isCurrent()) grid.innerHTML = `<p class="error">Не удалось загрузить карты: ${esc(err.message)}</p>`;
      return;
    }
    if (isCurrent()) renderGrid();
  }

  // ----- фильтры -----
  el.querySelector('.filter-input').addEventListener('input', (e) => {
    state.query = e.target.value.trim();
    renderGrid();
  });
  el.querySelectorAll('.color-filter button').forEach((b) =>
    b.addEventListener('click', () => {
      const c = b.dataset.color;
      state.colors.has(c) ? state.colors.delete(c) : state.colors.add(c);
      b.setAttribute('aria-pressed', String(state.colors.has(c)));
      renderGrid();
    }),
  );
  el.querySelector('.sort-select').addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderGrid();
  });

  // ----- подробности -----
  grid.addEventListener('click', (e) => {
    const tile = e.target.closest('.cool-tile');
    if (!tile) return;
    const entry = getCoolCards().find((x) => sameCard(x.name, tile.dataset.name));
    if (!entry) return;
    openCardDialog({
      entry,
      card: lookup(cardMap, entry.name),
      editor,
      onSave: async (note) => {
        try {
          await updateCoolCards(
            (list) => list.map((x) => (sameCard(x.name, entry.name) ? { ...x, note } : x)),
            `Крутые карты: заметка к ${entry.name}`,
          );
        } catch (err) {
          throw githubError(err);
        }
        toast('Заметка сохранена.');
        renderGrid();
      },
      onRemove: async () => {
        try {
          await updateCoolCards(
            (list) => list.filter((x) => !sameCard(x.name, entry.name)),
            `Крутые карты: убрана ${entry.name}`,
          );
        } catch (err) {
          throw githubError(err);
        }
        toast(`«${entry.name}» убрана из коллекции.`);
        renderGrid();
      },
    });
  });

  // ----- добавление (только редактор) -----
  if (editor) {
    const pick = el.querySelector('#pick');
    const search = mountCardSearch(el.querySelector('#card-search'), {
      onPick: (card) => showPick(card),
    });

    function showPick(card) {
      const exists = getCoolCards().some((x) => sameCard(x.name, card.name));
      pick.innerHTML = `
        <div class="pick">
          ${card.image ? `<img src="${esc(card.image)}" alt="${esc(card.name)}" ${card.backImage ? `data-img="${esc(card.image)}" data-back="${esc(card.backImage)}"` : ''}>` : ''}
          <div class="pick-info">
            <h3>${esc(card.name)} <span class="cost">${manaSymbols(card.manaCost)}</span></h3>
            <p class="muted">${esc(card.typeLine)}</p>
            ${
              exists
                ? '<p class="accent">Эта карта уже есть в коллекции.</p>'
                : `<label class="field">
                    <span>Чем нравится? <small class="muted">необязательно</small></span>
                    <textarea rows="3" class="note-input" placeholder="Пара слов, чтобы не забыть"></textarea>
                  </label>`
            }
            <p class="error" hidden></p>
            <div class="form-actions">
              <button type="button" class="btn" data-act="cancel">Отмена</button>
              ${exists ? '' : '<button type="button" class="btn btn-primary" data-act="add">Добавить в коллекцию</button>'}
            </div>
          </div>
        </div>`;

      pick.querySelector('[data-act="cancel"]').addEventListener('click', () => {
        pick.innerHTML = '';
        search.clear();
        search.focus();
      });

      const add = pick.querySelector('[data-act="add"]');
      add?.addEventListener('click', async () => {
        const error = pick.querySelector('.error');
        const note = pick.querySelector('.note-input').value.trim();
        error.hidden = true;
        add.disabled = true;
        add.textContent = 'Добавляю…';
        try {
          await updateCoolCards(
            (list) => (list.some((x) => sameCard(x.name, card.name)) ? list : [...list, { name: card.name, note, added: today() }]),
            `Крутые карты: ${card.name}`,
          );
        } catch (err) {
          error.textContent = githubError(err).message;
          error.hidden = false;
          add.disabled = false;
          add.textContent = 'Добавить в коллекцию';
          return;
        }
        cardMap.set(card.name.toLowerCase().split(' // ')[0], card);
        pick.innerHTML = '';
        search.clear();
        toast(`«${card.name}» добавлена в крутые карты!`);
        renderGrid();
        search.focus();
      });

      pick.querySelector('.note-input')?.focus();
    }
  }

  loadCards();
}

/** Полоска последних добавленных карт для главной страницы. */
export function renderCoolStrip(container, isCurrent, limit = 8) {
  const latest = getCoolCards()
    .map((entry, i) => ({ entry, i }))
    .sort(SORTS.added.fn)
    .slice(0, limit)
    .map(({ entry }) => entry);
  if (!latest.length) {
    container.closest('section')?.remove();
    return;
  }
  fetchCards(latest.map((e) => e.name))
    .then((map) => {
      if (!isCurrent()) return;
      container.innerHTML = latest
        .map((entry) => {
          const card = lookup(map, entry.name);
          return card?.image
            ? `<a class="strip-card" href="#/cards" data-img="${esc(card.image)}" title="${esc(entry.name)}"><img src="${esc(card.image)}" alt="${esc(entry.name)}" loading="lazy"></a>`
            : '';
        })
        .join('');
    })
    .catch(() => {});
}
