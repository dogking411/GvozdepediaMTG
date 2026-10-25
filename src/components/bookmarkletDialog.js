import { bookmarkletHref } from '../lib/bookmarklet.js';
import { esc } from '../lib/html.js';

// Пока закладку ни разу не брали — инструкция по установке раскрыта
const INSTALLED_KEY = 'gvozd:bookmarklet-installed';
const isInstalled = () => {
  try {
    return localStorage.getItem(INSTALLED_KEY) === '1';
  } catch {
    return false;
  }
};
const markInstalled = () => {
  try {
    localStorage.setItem(INSTALLED_KEY, '1');
  } catch {
    /* без запоминания — инструкция просто останется раскрытой */
  }
};

/**
 * Синхронизация с Moxfield через закладку «→ Gvozdepedia»: на странице колоды на Moxfield
 * она забирает колоду в браузере и открывает сайт (#/import/…) с готовым списком изменений.
 * onManual() — запасной путь: вставить экспорт из Moxfield вручную.
 */
export function openBookmarkletDialog({ deck, onManual }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog sync-dialog';
  dialog.innerHTML = `
    <div class="form">
      <h2>Синхронизация с Moxfield</h2>
      <ol class="sync-steps">
        <li>Открой колоду на Moxfield.</li>
        <li>Нажми закладку <b>«→ Gvozdepedia»</b>.</li>
        <li>Сайт откроется с готовым списком изменений — нажми <b>«Обновить колоду»</b>.</li>
      </ol>
      ${
        deck.moxfield
          ? `<p><a class="btn btn-primary" href="${esc(deck.moxfield)}" target="_blank" rel="noopener">Открыть колоду на Moxfield ↗</a></p>`
          : '<p class="error">У колоды не указана ссылка на Moxfield — добавь её в редакторе колоды.</p>'
      }

      <details class="hint bookmarklet-hint" ${isInstalled() ? '' : 'open'}>
        <summary>Как установить закладку</summary>
        <p><b>На компьютере:</b> перетащи эту кнопку на панель закладок (показать панель — Ctrl+Shift+B).</p>
        <p class="bookmarklet-actions">
          <a class="btn bookmarklet" href="${bookmarkletHref()}" title="Перетащи на панель закладок">→ Gvozdepedia</a>
          <button type="button" class="btn" data-act="copy-bookmarklet">📋 Скопировать для телефона</button>
        </p>
        <p><b>На телефоне</b> перетаскивать нельзя — закладку создают вручную:</p>
        <ol>
          <li>Нажми «Скопировать для телефона».</li>
          <li>Добавь в закладки любую страницу (например, эту), назови закладку <b>gvozd</b>.</li>
          <li>Отредактируй эту закладку и вставь скопированное в поле <b>адреса (URL)</b> вместо ссылки.</li>
          <li>На странице колоды в Moxfield: <b>Chrome (Android)</b> — набери <b>gvozd</b> в адресной строке и нажми
            на закладку в подсказках; <b>Safari (iPhone)</b> — открой закладки и нажми на неё.</li>
        </ol>
        <p class="muted small">Firefox на Android такие закладки не запускает — там удобнее «Вставить вручную».</p>
      </details>

      <div class="form-actions">
        <button type="button" class="btn" data-act="manual">Вставить вручную</button>
        <button type="button" class="btn" data-act="close">Закрыть</button>
      </div>
    </div>
  `;
  document.body.append(dialog);

  const bookmarklet = dialog.querySelector('.bookmarklet');
  // Здесь закладка ничего не сделает — её нужно перетащить и нажимать на Moxfield
  bookmarklet.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Перетащи кнопку на панель закладок, а нажимай её на странице колоды на Moxfield.');
  });
  bookmarklet.addEventListener('dragstart', markInstalled);

  dialog.querySelector('[data-act="copy-bookmarklet"]').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(bookmarkletHref());
      markInstalled();
      e.target.textContent = 'Скопировано ✓';
    } catch {
      e.target.textContent = 'Не удалось скопировать';
    }
  });

  dialog.querySelector('[data-act="manual"]').addEventListener('click', () => {
    dialog.close();
    onManual();
  });
  dialog.querySelector('[data-act="close"]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close()); // клик по фону
  dialog.addEventListener('close', () => dialog.remove());

  dialog.showModal();
}
