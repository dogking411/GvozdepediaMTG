import { parseDeckFile } from './deckFile.js';
import { DECKS_DIR, COOL_CARDS_FILE } from '../config.js';

// Весь контент сайта лежит в папке content/ и вшивается в сборку
const contentFiles = import.meta.glob(['/content/decks/*.md', '/content/cards.json'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const normalize = (raw) => raw.replace(/\r\n/g, '\n').trim();

// путь в репозитории (content/decks/krenko.md) -> текст файла
const built = new Map(Object.entries(contentFiles).map(([path, raw]) => [path.slice(1), normalize(raw)]));

// Пока GitHub пересобирает сайт (1–2 минуты), редактор видит свои правки из localStorage.
// Как только сборка догнала — локальная копия удаляется.
const PENDING_KEY = 'gvozd:pending-files';
const PENDING_TTL = 60 * 60 * 1000;

function readPending() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY)) || {};
  } catch {
    return {};
  }
}

function writePending(pending) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* без локальной копии правки появятся после пересборки */
  }
}

/** Запомнить только что сохранённый файл. raw = null — файл удалён. */
export function setPending(path, raw) {
  const pending = readPending();
  pending[path] = { raw: raw === null ? null : normalize(raw), t: Date.now() };
  writePending(pending);
}

function currentFiles() {
  const files = new Map(built);
  const pending = readPending();
  let changed = false;

  for (const [path, { raw, t }] of Object.entries(pending)) {
    const caughtUp = raw === null ? !files.has(path) : files.get(path) === raw;
    if (caughtUp || Date.now() - t > PENDING_TTL) {
      delete pending[path];
      changed = true;
    } else if (raw === null) {
      files.delete(path);
    } else {
      files.set(path, raw);
    }
  }
  if (changed) writePending(pending);
  return files;
}

export function getDecks() {
  return [...currentFiles()]
    .filter(([path]) => path.startsWith(`${DECKS_DIR}/`) && path.endsWith('.md'))
    .map(([path, raw]) => parseDeckFile(raw, path.slice(DECKS_DIR.length + 1, -3)))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export const findDeck = (slug) => getDecks().find((d) => d.slug === slug);

/** Коллекция «Крутые карты»: [{ name, note, added }] */
export function getCoolCards() {
  try {
    const list = JSON.parse(currentFiles().get(COOL_CARDS_FILE) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
