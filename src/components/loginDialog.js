import { login } from '../lib/auth.js';
import { explainError } from '../lib/github.js';
import { DEFAULT_REPO } from '../config.js';
import { esc } from '../lib/html.js';

const TOKEN_URL =
  'https://github.com/settings/personal-access-tokens/new?name=GvozdepediaMTG%20editor&contents=write';

export function openLoginDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog';
  dialog.innerHTML = `
    <form method="dialog" class="form">
      <h2>Вход для редактора</h2>
      <p class="muted">Смотреть сайт может кто угодно, а править — только владелец репозитория на GitHub.</p>

      <label class="field">
        <span>Репозиторий</span>
        <input name="repo" required placeholder="username/GvozdepediaMTG" value="${esc(DEFAULT_REPO)}" ${DEFAULT_REPO ? 'readonly' : ''}>
      </label>

      <label class="field">
        <span>GitHub-токен</span>
        <input name="token" type="password" required autocomplete="off" placeholder="github_pat_…">
      </label>

      <details class="hint">
        <summary>Где взять токен?</summary>
        <ol>
          <li>Открой <a href="${TOKEN_URL}" target="_blank" rel="noopener">создание токена на GitHub ↗</a> (Fine-grained token).</li>
          <li><b>Repository access</b> → Only select repositories → выбери репозиторий сайта.</li>
          <li><b>Permissions</b> → Repository → <b>Contents: Read and write</b>.</li>
          <li>Срок действия — какой удобно (например, год). Нажми Generate и вставь токен сюда.</li>
        </ol>
        <p>Токен хранится только в этом браузере. Никому его не показывай.</p>
      </details>

      <p class="error" id="login-error" hidden></p>

      <div class="form-actions">
        <button type="button" class="btn" value="cancel" id="login-cancel">Отмена</button>
        <button type="submit" class="btn btn-primary" id="login-submit">Войти</button>
      </div>
    </form>
  `;
  document.body.append(dialog);

  const form = dialog.querySelector('form');
  const error = dialog.querySelector('#login-error');
  const submit = dialog.querySelector('#login-submit');

  dialog.querySelector('#login-cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Проверяю…';
    try {
      await login(form.token.value, form.repo.value);
      dialog.close();
    } catch (err) {
      error.textContent = err.status ? explainError(err) : err.message;
      error.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = 'Войти';
    }
  });

  dialog.showModal();
  (DEFAULT_REPO ? form.token : form.repo).focus();
}
