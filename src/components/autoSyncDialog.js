import { getSession } from '../lib/auth.js';
import { dispatchWorkflow, getRun, getRunJobs, getFile, explainError } from '../lib/github.js';
import { parseDeckFile } from '../lib/deckFile.js';
import { diffMain } from '../lib/moxfieldExport.js';
import { DECKS_DIR } from '../config.js';
import { esc } from '../lib/html.js';
import { bookmarkletHref } from '../lib/bookmarklet.js';

const WORKFLOW = 'sync-moxfield.yml';
const POLL_MS = 3000;
const TIMEOUT_MS = 5 * 60 * 1000;

const QUEUED_HINT_MS = 20 * 1000;

const STEPS = [
  ['start', 'Запускаю синхронизацию на GitHub'],
  ['fetch', 'Твой компьютер забирает колоду с Moxfield'],
  ['save', 'Сохраняю изменения'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function dispatchError(err) {
  if (err.status === 403) {
    return `У токена нет права запускать задачи. Открой токен на GitHub (Settings → Developer settings → Fine-grained tokens),
      нажми <b>Edit</b> и в Permissions добавь <b>Actions: Read and write</b>. Перевходить на сайте не нужно.`;
  }
  if (err.status === 404) return 'Задача синхронизации не найдена в репозитории — сайт ещё не обновился после её добавления?';
  return esc(err.status ? explainError(err) : err.message);
}

/**
 * Автоматическая синхронизация: кнопка запускает GitHub Actions, который сам забирает
 * колоду с Moxfield и коммитит её. onDone(text) получает новый текст файла колоды,
 * onManual() открывает ручную синхронизацию через буфер.
 */
export function openAutoSyncDialog({ deck, onDone, onManual }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog sync-dialog';
  dialog.innerHTML = `
    <div class="form">
      <h2>Синхронизация с Moxfield</h2>
      <ol class="progress-steps">
        ${STEPS.map(([id, label]) => `<li data-step="${id}">${label}</li>`).join('')}
      </ol>
      <div class="sync-result"></div>
      <details class="hint bookmarklet-hint">
        <summary>Компьютер выключен? Есть закладка для Moxfield</summary>
        <p><b>На компьютере:</b> перетащи эту кнопку на панель закладок браузера.</p>
        <p class="bookmarklet-actions">
          <a class="btn bookmarklet" href="${bookmarkletHref()}" title="Перетащи на панель закладок">→ Gvozdepedia</a>
          <button type="button" class="btn" data-act="copy-bookmarklet">📋 Скопировать для телефона</button>
        </p>
        <p><b>На телефоне</b> перетаскивать нельзя — закладку создают вручную:</p>
        <ol>
          <li>Нажми «Скопировать для телефона».</li>
          <li>Добавь в закладки любую страницу (например, эту), назови закладку <b>gvozd</b>.</li>
          <li>Отредактируй эту закладку и вставь скопированное в поле <b>адреса (URL)</b> вместо ссылки.</li>
          <li>Открой свою колоду на Moxfield. <b>Chrome (Android):</b> набери <b>gvozd</b> в адресной строке и нажми
            на закладку в подсказках. <b>Safari (iPhone):</b> открой закладки и нажми на неё.</li>
        </ol>
        <p>Сайт откроется с готовым списком изменений — останется нажать «Обновить колоду».
          Firefox на Android такие закладки не запускает — там удобнее «Вставить вручную».</p>
      </details>
      <div class="form-actions">
        <button type="button" class="btn" data-act="manual" hidden>Вставить вручную</button>
        <button type="button" class="btn" data-act="close">Скрыть</button>
      </div>
    </div>
  `;
  document.body.append(dialog);

  const result = dialog.querySelector('.sync-result');
  const manual = dialog.querySelector('[data-act="manual"]');
  const closeBtn = dialog.querySelector('[data-act="close"]');
  let closed = false;

  const setStep = (id, state) => {
    const li = dialog.querySelector(`[data-step="${id}"]`);
    li.className = state;
  };
  const failWith = (html, runUrl) => {
    dialog.querySelectorAll('.progress-steps .active').forEach((li) => (li.className = 'failed'));
    result.innerHTML = `<p class="error">${html}</p>${runUrl ? `<p class="small"><a href="${esc(runUrl)}" target="_blank" rel="noopener">Подробности на GitHub ↗</a></p>` : ''}`;
    manual.hidden = false;
    closeBtn.textContent = 'Закрыть';
  };

  closeBtn.addEventListener('click', () => dialog.close());
  // Клик по закладке здесь ничего не даст — её нужно перетащить
  dialog.querySelector('.bookmarklet').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Перетащи кнопку на панель закладок, а нажимай её на странице колоды на Moxfield.');
  });
  dialog.querySelector('[data-act="copy-bookmarklet"]').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(bookmarkletHref());
      e.target.textContent = 'Скопировано ✓';
    } catch {
      e.target.textContent = 'Не удалось скопировать';
    }
  });
  manual.addEventListener('click', () => {
    dialog.close();
    onManual();
  });
  dialog.addEventListener('close', () => {
    closed = true;
    dialog.remove();
  });
  dialog.showModal();

  run();

  async function run() {
    if (!deck.moxfield) {
      failWith('У колоды не указана ссылка на Moxfield — добавь её в редакторе колоды (✎ Редактировать).');
      return;
    }
    const session = getSession();

    setStep('start', 'active');
    let runId;
    try {
      runId = await dispatchWorkflow(session, WORKFLOW, { slug: deck.slug }, (r) => r.display_title?.endsWith(` ${deck.slug}`));
    } catch (err) {
      failWith(dispatchError(err));
      return;
    }
    setStep('start', 'done');
    setStep('fetch', 'active');

    // Ждём, пока задача sync закончится (публикация сайта идёт следом, её не ждём)
    const startedAt = Date.now();
    const deadline = startedAt + TIMEOUT_MS;
    let job;
    while (!closed && Date.now() < deadline) {
      await sleep(POLL_MS);
      try {
        job = (await getRunJobs(session, runId)).jobs.find((j) => j.name === 'sync');
      } catch {
        continue; // временная ошибка сети — пробуем ещё
      }
      if (job?.status === 'completed') break;
      // Задача ждёт раннер: компьютер выключен или программа раннера не запущена
      if ((!job || job.status === 'queued') && Date.now() - startedAt > QUEUED_HINT_MS && !result.dataset.waiting) {
        result.dataset.waiting = '1';
        result.innerHTML = `<p class="muted">Жду твой компьютер — похоже, он выключен или раннер не запущен.
          Синхронизация выполнится, как только компьютер появится в сети. Окно можно закрыть.</p>`;
        manual.hidden = false;
        dialog.querySelector('.bookmarklet-hint').open = true;
      }
    }
    if (closed) return;

    if (job?.status !== 'completed') {
      const { html_url: url } = await getRun(session, runId).catch(() => ({}));
      failWith(
        job?.status === 'queued'
          ? 'Компьютер так и не появился в сети. Синхронизация останется в очереди и выполнится, когда он включится.'
          : 'Синхронизация идёт дольше обычного. Она продолжится на GitHub — загляни позже.',
        url,
      );
      return;
    }
    delete result.dataset.waiting;
    result.innerHTML = '';
    if (job.conclusion !== 'success') {
      const failed = job.steps?.find((s) => s.conclusion === 'failure')?.name;
      failWith(
        failed?.startsWith('Забрать колоду с Moxfield')
          ? 'Не удалось забрать колоду с Moxfield. Проверь, что она публичная и ссылка верная. Если Moxfield заблокировал запрос — используй «Вставить вручную».'
          : `Синхронизация не удалась${failed ? ` на шаге «${esc(failed)}»` : ''}.`,
        job.html_url,
      );
      return;
    }
    setStep('fetch', 'done');
    setStep('save', 'active');

    let file;
    try {
      file = await getFile(session, `${DECKS_DIR}/${deck.slug}.md`);
    } catch (err) {
      failWith(esc(explainError(err)));
      return;
    }
    setStep('save', 'done');

    const fresh = parseDeckFile(file.text, deck.slug);
    const { added, removed, changed } = diffMain(deck.decklistText, deck.commanders, fresh.decklistText, fresh.commanders);
    const sameSide = fresh.sideboardText.trim() === deck.sideboardText.trim();
    const nothing = !added.length && !removed.length && !changed.length && sameSide && fresh.decklistText.trim() === deck.decklistText.trim();
    const list = (items, fmt) => `<ul class="sync-list">${items.map((c) => `<li>${fmt(c)}</li>`).join('')}</ul>`;

    result.innerHTML = nothing
      ? '<p>Всё уже совпадает с Moxfield — изменений нет.</p>'
      : `
        <p><b>Готово!</b> Для остальных посетителей сайт обновится через минуту.</p>
        ${added.length ? `<h4 class="sync-add">Добавлены · ${added.length}</h4>${list(added, (c) => `${c.qty} ${esc(c.name)}`)}` : ''}
        ${removed.length ? `<h4 class="sync-remove">Убраны · ${removed.length}</h4>${list(removed, (c) => `${c.qty} ${esc(c.name)}`)}` : ''}
        ${changed.length ? `<h4>Изменилось количество · ${changed.length}</h4>${list(changed, (c) => `${esc(c.name)}: ${c.from} → ${c.qty}`)}` : ''}
        ${!added.length && !removed.length && !changed.length ? '<p class="muted">Состав прежний — обновились версии карт или Sideboard.</p>' : ''}
        <p class="muted small">Sideboard: ${fresh.sideboard.reduce((s, c) => s + c.qty, 0)} карт</p>`;
    closeBtn.textContent = 'Закрыть';
    if (!nothing) onDone(file.text);
  }
}
