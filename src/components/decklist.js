import { TYPE_GROUPS, OTHER_GROUP, primaryType } from '../lib/cardTypes.js';
import { manaSymbols } from '../lib/scryfall.js';
import { esc } from '../lib/html.js';

const byCmcThenName = (a, b) => (a.card?.cmc ?? 0) - (b.card?.cmc ?? 0) || a.name.localeCompare(b.name);

export function groupByType(entries) {
  const groups = [...TYPE_GROUPS, OTHER_GROUP].map((g) => ({ ...g, items: [] }));
  const missing = { key: 'Missing', label: 'Не найдены на Scryfall', items: [] };
  for (const e of entries) {
    if (!e.card) missing.items.push(e);
    else groups.find((g) => g.key === primaryType(e.card).key).items.push(e);
  }
  return [...groups, missing]
    .filter((g) => g.items.length)
    .map((g) => ({ ...g, items: g.items.sort(byCmcThenName), count: g.items.reduce((s, e) => s + e.qty, 0) }));
}

const imgAttrs = (card) =>
  card?.image ? `data-img="${esc(card.image)}"${card.backImage ? ` data-back="${esc(card.backImage)}"` : ''}` : '';

function row(e) {
  const name = e.card?.url
    ? `<a href="${esc(e.card.url)}" target="_blank" rel="noopener">${esc(e.name)}</a>`
    : esc(e.name);
  return `
    <li class="card-row" ${imgAttrs(e.card)}>
      <span class="qty">${e.qty}</span>
      <span class="card-name">${name}</span>
      <span class="cost">${manaSymbols(e.card?.manaCost)}</span>
    </li>`;
}

function tile(e) {
  if (!e.card?.image) return `<div class="card-tile missing">${esc(e.name)}</div>`;
  return `
    <a class="card-tile" href="${esc(e.card.url)}" target="_blank" rel="noopener" ${imgAttrs(e.card)}>
      <img src="${esc(e.card.image)}" alt="${esc(e.name)}" loading="lazy">
      ${e.qty > 1 ? `<span class="tile-qty">×${e.qty}</span>` : ''}
    </a>`;
}

export function renderDecklist(entries, view = 'list') {
  const groups = groupByType(entries);
  if (view === 'grid') {
    return groups
      .map(
        (g) => `
        <section class="type-group">
          <h4>${g.label} <span class="muted">${g.count}</span></h4>
          <div class="card-grid">${g.items.map(tile).join('')}</div>
        </section>`,
      )
      .join('');
  }
  return `<div class="decklist-columns">${groups
    .map(
      (g) => `
      <section class="type-group ${g.key === 'Missing' ? 'warn' : ''}">
        <h4>${g.label} <span class="muted">${g.count}</span></h4>
        <ul>${g.items.map(row).join('')}</ul>
      </section>`,
    )
    .join('')}</div>`;
}
