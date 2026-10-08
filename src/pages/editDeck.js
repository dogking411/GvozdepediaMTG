import { getSession, isEditor } from '../lib/auth.js';
import { getFile, putFile, deleteFile, explainError } from '../lib/github.js';
import { parseDeckFile, parseDecklist, serializeDeck } from '../lib/deckFile.js';
import { setPending } from '../lib/content.js';
import { DECKS_DIR } from '../config.js';
import { esc } from '../lib/html.js';
import { openLoginDialog } from '../components/loginDialog.js';
import { toast } from '../components/toast.js';

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

const slugify = (s) =>
  [...s.toLowerCase()]
    .map((c) => TRANSLIT[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const pathFor = (slug) => `${DECKS_DIR}/${slug}.md`;

export async function editDeckPage(el, slug, isCurrent) {
  const isNew = !slug;
  document.title = `${isNew ? 'Новая колода' : 'Редактирование'} — GvozdepediaMTG`;

  if (!isEditor()) {
    el.innerHTML = `
      <div class="empty-state">
        <h1>Только для редактора</h1>
        <p class="muted">Войди, чтобы создавать и редактировать колоды.</p>
        <button class="btn btn-primary" id="need-login">Войти</button>
      </div>`;
    el.querySelector('#need-login').addEventListener('click', openLoginDialog);
    return;
  }

  let deck = { name: '', commanders: [], moxfield: '', primer: '', thoughts: '', decklistText: '' };
  let sha;

  if (!isNew) {
    el.innerHTML = '<p class="muted">Загружаю колоду с GitHub…</p>';
    let file;
    try {
      file = await getFile(getSession(), pathFor(slug));
    } catch (err) {
      if (isCurrent()) el.innerHTML = `<p class="error">${esc(explainError(err))}</p>`;
      return;
    }
    if (!isCurrent()) return;
    if (!file) {
      el.innerHTML = `<p class="error">Файл ${esc(pathFor(slug))} не найден в репозитории.</p>`;
      return;
    }
    deck = parseDeckFile(file.text, slug);
    sha = file.sha;
  }

  el.innerHTML = `
    <form class="editor form" novalidate>
      <div class="section-head">
        <div>
          <p class="eyebrow">${isNew ? 'Новая колода' : 'Редактирование'}</p>
          <h1>${isNew ? 'Новая колода' : esc(deck.name)}</h1>
        </div>
        <div class="form-actions">
          <a class="btn" href="${isNew ? '#/decks' : `#/decks/${slug}`}">Отмена</a>
          <button type="submit" class="btn btn-primary" id="save-btn">Сохранить</button>
        </div>
      </div>

      <div class="editor-grid">
        <section class="panel">
          <h2>Основное</h2>
          <label class="field">
            <span>Название колоды</span>
            <input name="deckName" required value="${esc(deck.name)}" placeholder="Гоблинская орда Кренко">
          </label>
          <label class="field">
            <span>Адрес страницы <small class="muted">латиница, цифры и дефис; потом не меняется</small></span>
            <div class="input-prefix"><span>#/decks/</span><input name="slug" required value="${esc(slug || '')}" ${isNew ? '' : 'readonly'} placeholder="krenko"></div>
          </label>
          <div class="field-row">
            <label class="field">
              <span>Командир <small class="muted">английское название</small></span>
              <input name="commander" required value="${esc(deck.commanders[0] || '')}" placeholder="Krenko, Mob Boss">
            </label>
            <label class="field">
              <span>Второй командир <small class="muted">если партнёры</small></span>
              <input name="partner" value="${esc(deck.commanders[1] || '')}">
            </label>
          </div>
          <label class="field">
            <span>Ссылка на Moxfield</span>
            <input name="moxfield" type="url" value="${esc(deck.moxfield)}" placeholder="https://moxfield.com/decks/…">
          </label>
          <label class="field">
            <span>Праймер <small class="muted">Markdown</small></span>
            <textarea name="primer" rows="6">${esc(deck.primer)}</textarea>
          </label>
          <label class="field">
            <span>Мысли о колоде <small class="muted">Markdown: ### заголовок, - пункт, **жирный**</small></span>
            <textarea name="thoughts" rows="12">${esc(deck.thoughts)}</textarea>
          </label>
        </section>

        <section class="panel">
          <h2>Деклист <span class="muted" id="card-count"></span></h2>
          <label class="field">
            <span>Вставь экспорт из Moxfield: «1 Sol Ring» — по карте в строке</span>
            <textarea name="decklist" class="mono" rows="30" spellcheck="false">${esc(deck.decklistText)}</textarea>
          </label>
        </section>
      </div>

      <p class="error" id="form-error" hidden></p>

      ${
        isNew
          ? ''
          : `<div class="danger-zone">
              <button type="button" class="btn btn-danger" id="delete-btn">Удалить колоду</button>
            </div>`
      }
    </form>
  `;

  const form = el.querySelector('form');
  const f = form.elements;
  const error = el.querySelector('#form-error');
  const saveBtn = el.querySelector('#save-btn');

  // Адрес страницы предлагается из названия, пока его не поменяли вручную
  let slugTouched = !isNew;
  f.slug.addEventListener('input', () => (slugTouched = true));
  f.deckName.addEventListener('input', () => {
    if (!slugTouched) f.slug.value = slugify(f.deckName.value);
  });

  const updateCount = () => {
    const commanders = [f.commander.value, f.partner.value].filter((s) => s.trim());
    const n = parseDecklist(f.decklist.value, commanders).reduce((s, c) => s + c.qty, 0) + commanders.length;
    el.querySelector('#card-count').textContent = `${n} карт`;
  };
  f.decklist.addEventListener('input', updateCount);
  updateCount();

  const fail = (message) => {
    error.textContent = message;
    error.hidden = false;
    error.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;

    const newSlug = f.slug.value.trim();
    if (!f.deckName.value.trim()) return fail('Укажи название колоды.');
    if (!SLUG_RE.test(newSlug) || newSlug === 'new') return fail('Адрес страницы: только латиница, цифры и дефис (например, krenko-goblins).');
    if (!f.commander.value.trim()) return fail('Укажи командира.');

    const text = serializeDeck({
      name: f.deckName.value,
      commanders: [f.commander.value, f.partner.value],
      moxfield: f.moxfield.value,
      primer: f.primer.value,
      thoughts: f.thoughts.value,
      decklistText: f.decklist.value,
    });

    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохраняю…';
    try {
      const session = getSession();
      if (isNew && (await getFile(session, pathFor(newSlug)))) {
        return fail('Колода с таким адресом уже есть — придумай другой.');
      }
      await putFile(
        session,
        pathFor(newSlug),
        text,
        `${isNew ? 'Новая колода' : 'Обновлена колода'}: ${f.deckName.value.trim()}`,
        sha,
      );
      setPending(pathFor(newSlug), text);
      toast('Сохранено! Для остальных посетителей сайт обновится через 1–2 минуты.');
      location.hash = `#/decks/${newSlug}`;
    } catch (err) {
      fail(explainError(err));
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Сохранить';
    }
  });

  el.querySelector('#delete-btn')?.addEventListener('click', async () => {
    if (!confirm(`Удалить колоду «${deck.name}»? Её можно будет восстановить только через историю на GitHub.`)) return;
    try {
      await deleteFile(getSession(), pathFor(slug), `Удалена колода: ${deck.name}`, sha);
      setPending(pathFor(slug), null);
      toast('Колода удалена.');
      location.hash = '#/decks';
    } catch (err) {
      fail(explainError(err));
    }
  });
}
