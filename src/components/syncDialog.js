import { planSync } from '../lib/moxfieldExport.js';
import { esc } from '../lib/html.js';

const cardList = (list, fmt) =>
  list.length ? `<ul class="sync-list">${list.map((c) => `<li>${fmt(c)}</li>`).join('')}</ul>` : '';

function renderPlan(plan) {
  if (plan.empty) return '<p class="muted">Вставь экспорт из Moxfield — здесь появится список изменений.</p>';
  const nothing = !plan.added.length && !plan.removed.length && !plan.changed.length && !plan.commandersChanged;
  return `
    <div class="sync-summary">
      <span><b>${plan.mainCount}</b> карт в колоде</span>
      <span><b>${plan.sideCount}</b> в Sideboard${plan.sideboardFromExport ? '' : ' <small class="muted">(в экспорте нет — оставлю как есть)</small>'}</span>
    </div>
    ${plan.commandersChanged ? `<p>Командир: <b>${plan.commanders.map(esc).join(' + ')}</b></p>` : ''}
    ${plan.added.length ? `<h4 class="sync-add">Добавлены · ${plan.added.length}</h4>${cardList(plan.added, (c) => `${c.qty} ${esc(c.name)}`)}` : ''}
    ${plan.removed.length ? `<h4 class="sync-remove">Убраны · ${plan.removed.length}</h4>${cardList(plan.removed, (c) => `${c.qty} ${esc(c.name)}`)}` : ''}
    ${plan.changed.length ? `<h4>Изменилось количество · ${plan.changed.length}</h4>${cardList(plan.changed, (c) => `${esc(c.name)}: ${c.from} → ${c.qty}`)}` : ''}
    ${nothing ? `<p class="muted">Состав основной колоды не изменился${plan.printingsChanged ? ', но поменялись версии (арты) карт' : ''}.</p>` : ''}
  `;
}

/**
 * Синхронизация с Moxfield через буфер обмена: Moxfield не даёт сайтам
 * читать колоды напрямую, поэтому редактор копирует экспорт и вставляет сюда.
 * onApply(plan) сохраняет изменения и возвращает промис.
 */
export function openSyncDialog({ deck, onApply }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog sync-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="form">
      <h2>Синхронизация с Moxfield</h2>
      <ol class="sync-steps">
        <li>Открой колоду на Moxfield${deck.moxfield ? ` (<a href="${esc(deck.moxfield)}" target="_blank" rel="noopener">ссылка ↗</a>)` : ''} → <b>Export</b> → скопируй текст колоды (лучше вариант «for Moxfield» — с сетами и номерами, тогда сохранятся твои арты).</li>
        <li>Вернись сюда и нажми <b>«Вставить из буфера»</b> (или вставь текст в поле сам).</li>
      </ol>
      <div class="sync-paste">
        <button type="button" class="btn" data-act="paste">📋 Вставить из буфера</button>
        <textarea class="mono note-input" rows="6" spellcheck="false" placeholder="1 Sol Ring (CMM) 400&#10;…&#10;&#10;SIDEBOARD:&#10;1 Damping Sphere (MH3) 255"></textarea>
      </div>
      <div class="sync-plan"></div>
      <p class="muted small">Праймер и мысли о колоде не меняются. Заметки к картам Sideboard сохраняются.</p>
      <p class="error" hidden></p>
      <div class="form-actions">
        <button type="button" class="btn" data-act="cancel">Отмена</button>
        <button type="submit" class="btn btn-primary" data-act="apply" disabled>Обновить колоду</button>
      </div>
    </form>
  `;
  document.body.append(dialog);

  const form = dialog.querySelector('form');
  const textarea = dialog.querySelector('textarea');
  const planEl = dialog.querySelector('.sync-plan');
  const apply = dialog.querySelector('[data-act="apply"]');
  const error = dialog.querySelector('.error');
  let plan = null;

  const update = () => {
    plan = textarea.value.trim() ? planSync(deck, textarea.value) : null;
    planEl.innerHTML = plan ? renderPlan(plan) : '';
    apply.disabled = !plan || plan.empty;
  };
  textarea.addEventListener('input', update);

  dialog.querySelector('[data-act="paste"]').addEventListener('click', async () => {
    try {
      textarea.value = await navigator.clipboard.readText();
      update();
    } catch {
      textarea.focus();
      error.textContent = 'Браузер не дал прочитать буфер — вставь текст в поле вручную (Ctrl+V).';
      error.hidden = false;
    }
  });

  dialog.querySelector('[data-act="cancel"]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!plan || plan.empty) return;
    error.hidden = true;
    apply.disabled = true;
    apply.textContent = 'Сохраняю…';
    try {
      await onApply(plan);
      dialog.close();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      apply.disabled = false;
      apply.textContent = 'Обновить колоду';
    }
  });

  dialog.showModal();
}
