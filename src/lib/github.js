// Минимальная обёртка над GitHub REST API: чтение и запись файлов в репозитории.

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(token, path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    let message = `GitHub ответил ${res.status}`;
    try {
      message = (await res.json()).message || message;
    } catch {
      /* тело без JSON */
    }
    throw new GitHubError(res.status, message);
  }
  return res.status === 204 ? null : res.json();
}

// base64 <-> UTF-8 (atob/btoa сами по себе не понимают кириллицу)
const toBase64 = (text) => {
  let bin = '';
  for (const byte of new TextEncoder().encode(text)) bin += String.fromCharCode(byte);
  return btoa(bin);
};
const fromBase64 = (b64) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

export const getUser = (token) => request(token, '/user');
export const getRepo = (token, repo) => request(token, `/repos/${repo}`);

/** Возвращает { text, sha } или null, если файла нет. */
export async function getFile({ token, repo, branch }, path) {
  try {
    const file = await request(token, `/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`);
    return { text: fromBase64(file.content), sha: file.sha };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/** Создаёт файл (sha не указан) или обновляет существующий. */
export function putFile({ token, repo, branch }, path, text, message, sha) {
  return request(token, `/repos/${repo}/contents/${encodePath(path)}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: toBase64(text), branch, ...(sha ? { sha } : {}) }),
  });
}

export function deleteFile({ token, repo, branch }, path, message, sha) {
  return request(token, `/repos/${repo}/contents/${encodePath(path)}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch }),
  });
}

export function explainError(err) {
  if (err.status === 401) return 'Токен недействителен или истёк — войди заново.';
  if (err.status === 403) return 'У токена нет прав на запись. Нужно разрешение Contents: Read and write.';
  if (err.status === 404) return 'Репозиторий не найден или у токена нет к нему доступа.';
  if (err.status === 409) return 'Файл успел измениться на GitHub. Обнови страницу и попробуй ещё раз.';
  return err.message;
}
