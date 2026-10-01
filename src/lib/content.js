import { parseDeckFile } from './deckFile.js';

// Все файлы колод подхватываются автоматически — достаточно положить .md в content/decks
const deckFiles = import.meta.glob('/content/decks/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const normalize = (raw) => raw.replace(/\r\n/g, '\n').trim();

const built = new Map(
  Object.entries(deckFiles).map(([path, raw]) => [path.split('/').pop().replace(/\.md$/, ''), normalize(raw)]),
);

// Пока GitHub пересобирает сайт (1–2 минуты), редактор видит свои правки из localStorage.
// Как только сборка догнала — локальная копия удаляется.
const PENDING_KEY = 'gvozd:pending-decks';
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

/** raw = null означает, что колода удалена. */
export function setPendingDeck(slug, raw) {
  const pending = readPending();
  pending[slug] = { raw: raw === null ? null : normalize(raw), t: Date.now() };
  writePending(pending);
}

export function getDecks() {
  const files = new Map(built);
  const pending = readPending();
  let changed = false;

  for (const [slug, { raw, t }] of Object.entries(pending)) {
    const caughtUp = raw === null ? !files.has(slug) : files.get(slug) === raw;
    if (caughtUp || Date.now() - t > PENDING_TTL) {
      delete pending[slug];
      changed = true;
    } else if (raw === null) {
      files.delete(slug);
    } else {
      files.set(slug, raw);
    }
  }
  if (changed) writePending(pending);

  return [...files]
    .map(([slug, raw]) => parseDeckFile(raw, slug))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export const findDeck = (slug) => getDecks().find((d) => d.slug === slug);
