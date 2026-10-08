import { renderSidebar } from './components/sidebar.js';
import { initCardPreview } from './components/cardPreview.js';
import { openLoginDialog } from './components/loginDialog.js';
import { logout } from './lib/auth.js';
import { deckPage } from './pages/deck.js';
import { editDeckPage } from './pages/editDeck.js';
import { homePage, decksPage, comingSoon, notFound } from './pages/misc.js';
import { coolCardsPage } from './pages/coolCards.js';

const app = document.querySelector('.app');
const sidebar = document.getElementById('sidebar');
const page = document.getElementById('page');
const COLLAPSED_KEY = 'gvozd:sidebar-collapsed';

try {
  if (localStorage.getItem(COLLAPSED_KEY) === '1') app.classList.add('sidebar-collapsed');
} catch {
  /* без запоминания */
}

let navId = 0;

function route() {
  const id = ++navId;
  const isCurrent = () => id === navId;
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [section, slug, action] = parts;

  renderSidebar(sidebar, parts);
  app.classList.remove('sidebar-open');
  window.scrollTo(0, 0);

  if (!section) homePage(page, isCurrent);
  else if (section === 'decks' && slug === 'new') editDeckPage(page, null, isCurrent);
  else if (section === 'decks' && slug && action === 'edit') editDeckPage(page, slug, isCurrent);
  else if (section === 'decks' && slug && !action) deckPage(page, slug, isCurrent);
  else if (section === 'decks' && !slug) decksPage(page, isCurrent);
  else if (section === 'cards') coolCardsPage(page, isCurrent);
  else if (section === 'guides') comingSoon(page, 'Гайды');
  else if (section === 'news') comingSoon(page, 'Новости');
  else if (section === 'tournaments') comingSoon(page, 'Турниры EDH');
  else notFound(page);
}

sidebar.addEventListener('click', (e) => {
  if (e.target.closest('#login-btn')) return openLoginDialog();
  if (e.target.closest('#logout-btn')) return logout();
  if (!e.target.closest('#collapse-btn')) return;
  const collapsed = app.classList.toggle('sidebar-collapsed');
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    /* без запоминания */
  }
});
document.getElementById('menu-toggle').addEventListener('click', () => app.classList.add('sidebar-open'));
document.getElementById('sidebar-backdrop').addEventListener('click', () => app.classList.remove('sidebar-open'));

initCardPreview(document.getElementById('card-preview'));
window.addEventListener('hashchange', route);
window.addEventListener('gvozd:auth', route); // вошёл/вышел — перерисовать кнопки редактора
route();
