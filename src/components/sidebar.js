import { getDecks } from '../lib/content.js';
import { getSession } from '../lib/auth.js';
import { esc } from '../lib/html.js';
import logoSvg from '../assets/logo.svg?raw';

const icon = (paths) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
  home: icon('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  decks: icon('<rect x="7" y="3" width="13" height="17" rx="2"/><path d="M4 7v12a2 2 0 0 0 2 2h10"/>'),
  cards: icon('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  guides: icon('<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v14h-7"/>'),
  news: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>'),
  tournaments: icon('<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  collapse: icon('<path d="M15 6l-6 6 6 6"/>'),
  login: icon('<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>'),
  logout: icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>'),
};

const SECTIONS = [
  { id: 'home', href: '#/', label: 'Главная' },
  { id: 'decks', href: '#/decks', label: 'Колоды' },
  { id: 'cards', href: '#/cards', label: 'Крутые карты' },
  { id: 'guides', href: '#/guides', label: 'Гайды', soon: true },
  { id: 'news', href: '#/news', label: 'Новости', soon: true },
  { id: 'tournaments', href: '#/tournaments', label: 'Турниры EDH', soon: true },
];

function account() {
  const session = getSession();
  if (!session) {
    return `
      <button class="nav-item account-btn" id="login-btn" title="Вход для редактора">
        ${ICONS.login}<span class="nav-label">Войти</span>
      </button>`;
  }
  return `
    <div class="account" title="Редактор: ${esc(session.user.login)}">
      <img class="avatar" src="${esc(session.user.avatar)}" alt="">
      <div class="account-info nav-label">
        <span class="account-name">${esc(session.user.login)}</span>
        <span class="account-role">редактор</span>
      </div>
      <button class="icon-btn" id="logout-btn" title="Выйти" aria-label="Выйти">${ICONS.logout}</button>
    </div>`;
}

export function renderSidebar(el, route) {
  const [section, slug] = route;
  const active = section || 'home';
  const editor = Boolean(getSession());

  el.innerHTML = `
    <div class="sidebar-head">
      <a class="logo" href="#/" title="GvozdepediaMTG">
        <span class="logo-mark">${logoSvg}</span>
        <span class="logo-text">Gvozdepedia<span>MTG</span></span>
      </a>
      <button class="collapse-btn" id="collapse-btn" aria-label="Свернуть меню">${ICONS.collapse}</button>
    </div>
    <nav class="nav">
      ${SECTIONS.map(
        (s) => `
        <a class="nav-item ${active === s.id ? 'active' : ''}" href="${s.href}" title="${s.label}">
          ${ICONS[s.id]}
          <span class="nav-label">${s.label}</span>
          ${s.soon ? '<span class="soon">скоро</span>' : ''}
        </a>
        ${
          s.id === 'decks'
            ? `<div class="nav-sub">${getDecks()
                .map(
                  (d) =>
                    `<a class="nav-subitem ${slug === d.slug ? 'active' : ''}" href="#/decks/${d.slug}">${esc(d.name)}</a>`,
                )
                .join('')}${
                editor
                  ? `<a class="nav-subitem nav-add ${slug === 'new' ? 'active' : ''}" href="#/decks/new">+ Новая колода</a>`
                  : ''
              }</div>`
            : ''
        }`,
      ).join('')}
    </nav>
    <div class="sidebar-foot">${account()}</div>
  `;
}
