import { getDecks } from '../lib/content.js';
import { isEditor } from '../lib/auth.js';
import { esc } from '../lib/html.js';
import { openLoginDialog } from '../components/loginDialog.js';
import { deckPage } from './deck.js';

// #/import/<moxfield id>/<текст колоды> — сюда приводит закладка «→ Gvozdepedia» с Moxfield
export function importPage(el, moxId, text, isCurrent) {
  document.title = 'Синхронизация — GvozdepediaMTG';

  if (!isEditor()) {
    // После входа роутер перерисует этот же адрес, и импорт продолжится
    el.innerHTML = `
      <div class="empty-state">
        <h1>Синхронизация с Moxfield</h1>
        <p class="muted">Чтобы обновить колоду, войди как редактор.</p>
        <button class="btn btn-primary" id="need-login">Войти</button>
      </div>`;
    el.querySelector('#need-login').addEventListener('click', openLoginDialog);
    return;
  }

  const deck = getDecks().find((d) => d.moxfield.includes(`/decks/${moxId}`));
  if (!deck) {
    el.innerHTML = `
      <div class="empty-state">
        <h1>Колода не найдена</h1>
        <p class="muted">На сайте нет колоды со ссылкой на эту колоду Moxfield (<code>${esc(moxId)}</code>).</p>
        <p class="muted">Создай колоду и укажи ссылку на Moxfield — потом закладка сработает.</p>
        <a class="btn btn-primary" href="#/decks/new">+ Новая колода</a>
      </div>`;
    return;
  }

  // Убираем длинный список из адреса, не перезапуская роутер
  history.replaceState(null, '', `#/decks/${deck.slug}`);
  deckPage(el, deck.slug, isCurrent, { importText: text });
}
