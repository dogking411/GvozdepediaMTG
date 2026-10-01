// Вход редактора: GitHub-токен хранится только в браузере редактора.
// Править сайт может лишь тот, у кого есть права на запись в репозиторий —
// это проверяет сам GitHub при каждом сохранении.

import { getRepo, getUser } from './github.js';

const KEY = 'gvozd:auth';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

let session = read();

const emit = () => window.dispatchEvent(new Event('gvozd:auth'));

export const getSession = () => session;
export const isEditor = () => Boolean(session?.token);

export async function login(token, repoName) {
  token = token.trim();
  repoName = repoName.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
  const [repo, user] = await Promise.all([getRepo(token, repoName), getUser(token)]);
  if (repo.permissions && !repo.permissions.push) {
    throw new Error(`У пользователя ${user.login} нет прав на запись в ${repo.full_name}.`);
  }
  session = {
    token,
    repo: repo.full_name,
    branch: repo.default_branch,
    user: { login: user.login, avatar: user.avatar_url },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* без запоминания — вход до перезагрузки страницы */
  }
  emit();
}

export function logout() {
  session = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* нечего чистить */
  }
  emit();
}
