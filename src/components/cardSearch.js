import { autocomplete, namedCard, searchCards } from '../lib/scryfall.js';
import { esc } from '../lib/html.js';

const MAX_RESULTS = 60;

/**
 * Поиск карт как на Scryfall: подсказки названий по мере ввода,
 * Enter без выбранной подсказки — полный поиск с синтаксисом Scryfall.
 * onPick(card) вызывается, когда карта выбрана.
 */
export function mountCardSearch(root, { onPick }) {
  root.innerHTML = `
    <div class="search">
      <div class="search-box">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
        <input type="search" placeholder="Название карты или запрос Scryfall, например t:artifact o:token"
          autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="ac-list" aria-autocomplete="list">
      </div>
      <ul class="ac-list" id="ac-list" role="listbox" hidden></ul>
    </div>
    <p class="search-hint muted">Выбери подсказку или нажми Enter, чтобы искать по <a href="https://scryfall.com/docs/syntax" target="_blank" rel="noopener">синтаксису Scryfall</a>.</p>
    <div class="search-results"></div>
  `;

  const input = root.querySelector('input');
  const list = root.querySelector('.ac-list');
  const results = root.querySelector('.search-results');
  let suggestions = [];
  let active = -1;
  let timer;
  let controller;

  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    active = -1;
  };

  const renderList = () => {
    list.innerHTML = suggestions
      .map((name, i) => `<li role="option" id="ac-${i}" data-i="${i}" aria-selected="${i === active}">${esc(name)}</li>`)
      .join('');
    list.hidden = !suggestions.length;
    input.setAttribute('aria-expanded', String(!list.hidden));
    if (active >= 0) input.setAttribute('aria-activedescendant', `ac-${active}`);
    else input.removeAttribute('aria-activedescendant');
  };

  const pickName = async (name) => {
    close();
    input.value = name;
    results.innerHTML = '<p class="muted">Загружаю карту…</p>';
    try {
      const card = await namedCard(name);
      results.innerHTML = '';
      onPick(card);
    } catch (err) {
      results.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  };

  const runSearch = async (query) => {
    close();
    if (!query.trim()) return;
    results.innerHTML = '<p class="muted">Ищу на Scryfall…</p>';
    try {
      const { cards, total } = await searchCards(query);
      if (!cards.length) {
        results.innerHTML = '<p class="muted">Ничего не найдено.</p>';
        return;
      }
      if (cards.length === 1) {
        results.innerHTML = '';
        onPick(cards[0]);
        return;
      }
      const shown = cards.slice(0, MAX_RESULTS);
      results.innerHTML = `
        <p class="muted">Найдено ${total}${total > shown.length ? `, показаны первые ${shown.length} — уточни запрос` : ''}. Нажми на карту, чтобы выбрать.</p>
        <div class="card-grid">
          ${shown
            .map(
              (c, i) => `
              <button type="button" class="card-tile" data-i="${i}" title="${esc(c.name)}">
                ${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy">` : esc(c.name)}
              </button>`,
            )
            .join('')}
        </div>`;
      results.querySelectorAll('.card-tile').forEach((tile) =>
        tile.addEventListener('click', () => {
          results.innerHTML = '';
          onPick(shown[Number(tile.dataset.i)]);
        }),
      );
    } catch (err) {
      results.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        suggestions = (await autocomplete(input.value, controller.signal)).slice(0, 10);
      } catch {
        return; // запрос отменён более новым вводом
      }
      active = -1;
      renderList();
    }, 150);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (list.hidden || !suggestions.length) return;
      e.preventDefault();
      // -1 — курсор в поле ввода; стрелки ходят по кругу
      const n = suggestions.length;
      if (e.key === 'ArrowDown') active = active + 1 >= n ? -1 : active + 1;
      else active = active - 1 < -1 ? n - 1 : active - 1;
      renderList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timer);
      if (active >= 0) pickName(suggestions[active]);
      else runSearch(input.value);
    } else if (e.key === 'Escape') {
      close();
    }
  });

  // mousedown, чтобы сработать раньше потери фокуса
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    e.preventDefault();
    pickName(suggestions[Number(li.dataset.i)]);
  });
  input.addEventListener('blur', () => setTimeout(close, 100));
  input.addEventListener('focus', () => suggestions.length && renderList());

  return { focus: () => input.focus(), clear: () => ((input.value = ''), (suggestions = []), close()) };
}
