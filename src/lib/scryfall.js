// Загрузка данных о картах со Scryfall (https://scryfall.com/docs/api)
// с кэшем в localStorage, чтобы не дёргать API при каждом открытии страницы.
//
// Карту можно запросить тремя способами («запрос»):
//   'Sol Ring'                                    — по названию (подходит и флейвор-имя: 'Fangorn Forest')
//   { name: 'Fangorn Forest', set: 'LTC', number: '377' } — конкретная печать из экспорта Moxfield
//   { id: '<scryfall id>' }                      — конкретная печать по id

const BASE = 'https://api.scryfall.com';
const BATCH = 75; // лимит Scryfall на один запрос /cards/collection
const CACHE_PREFIX = 'gvozd:card:v3:';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const memory = new Map();

// Двусторонние карты: Scryfall пишет "A // B", Moxfield — "A / B". Ищем по лицевой стороне.
const frontName = (name) => name.split(/\s+\/\/?\s+/)[0].trim();

/** Ключ запроса — по нему карта лежит в кэше и в Map из fetchCards. */
export function requestKey(req) {
  if (typeof req === 'string') return frontName(req).toLowerCase();
  if (req.id) return `id:${req.id}`;
  if (req.set && req.number) return `${req.set}/${req.number}`.toLowerCase();
  return frontName(req.name).toLowerCase();
}

/** Запрос для строки деклиста: с сетом и номером, если они указаны. */
export const requestFor = (c) => (c.set && c.number ? { name: c.name, set: c.set, number: c.number } : c.name);

function readCache(k) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + k);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.t > CACHE_TTL) return null;
    return entry.c;
  } catch {
    return null;
  }
}

function writeCache(k, card) {
  memory.set(k, card);
  try {
    localStorage.setItem(CACHE_PREFIX + k, JSON.stringify({ t: Date.now(), c: card }));
  } catch {
    /* хранилище недоступно или переполнено — просто работаем без кэша */
  }
}

// Оставляем только нужные поля, чтобы кэш был компактным
function slim(card) {
  const faces = card.card_faces || [];
  const front = faces[0] || {};
  const images = card.image_uris || front.image_uris || {};
  return {
    id: card.id,
    oracleId: card.oracle_id ?? front.oracle_id,
    name: card.name,
    flavorName: card.flavor_name ?? front.flavor_name ?? '',
    set: card.set,
    setName: card.set_name,
    number: card.collector_number,
    manaCost: card.mana_cost ?? front.mana_cost ?? '',
    cmc: card.cmc ?? 0,
    typeLine: card.type_line ?? front.type_line ?? '',
    colors: card.colors ?? front.colors ?? [],
    colorIdentity: card.color_identity ?? [],
    image: images.normal || '',
    art: images.art_crop || '',
    backImage: faces[1]?.image_uris?.normal || '',
    url: card.scryfall_uri,
    prices: card.prices?.usd || card.prices?.usd_foil || null,
    text: card.oracle_text ?? faces.map((f) => f.oracle_text).filter(Boolean).join('\n\n'),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || '').toLowerCase();

function identifier(req) {
  if (typeof req === 'string') return { name: frontName(req) };
  if (req.id) return { id: req.id };
  if (req.set && req.number) return { set: req.set.toLowerCase(), collector_number: String(req.number) };
  return { name: frontName(req.name) };
}

// Подходит ли карта из ответа Scryfall к нашему запросу
function matches(req, raw) {
  const id = identifier(req);
  if (id.id) return raw.id === id.id;
  if (id.set) return raw.set === id.set && norm(raw.collector_number) === norm(id.collector_number);
  const want = norm(id.name);
  const faces = raw.card_faces || [];
  return [raw.name, frontName(raw.name), raw.flavor_name, ...faces.map((f) => f.name), ...faces.map((f) => f.flavor_name)]
    .some((n) => norm(n) === want);
}

async function fetchNamed(name) {
  const res = await fetch(`${BASE}/cards/named?exact=${encodeURIComponent(frontName(name))}`);
  return res.ok ? res.json() : null;
}

/**
 * Возвращает Map<requestKey, карта> для переданных запросов.
 * Ненайденные карты в Map не попадают.
 */
export async function fetchCards(requests) {
  const result = new Map();
  const missing = new Map(); // ключ -> запрос

  for (const req of requests) {
    const k = requestKey(req);
    if (result.has(k) || missing.has(k)) continue;
    const cached = memory.get(k) || readCache(k);
    if (cached) {
      memory.set(k, cached);
      result.set(k, cached);
    } else {
      missing.set(k, req);
    }
  }

  const pending = [...missing];
  const notFound = [];

  for (let i = 0; i < pending.length; i += BATCH) {
    if (i > 0) await sleep(100); // вежливая пауза между запросами
    const batch = pending.slice(i, i + BATCH);
    const res = await fetch(`${BASE}/cards/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identifiers: batch.map(([, req]) => identifier(req)) }),
    });
    if (!res.ok) throw new Error(`Scryfall ответил ${res.status}`);
    const { data } = await res.json();
    for (const [k, req] of batch) {
      const raw = data.find((c) => matches(req, c));
      if (raw) {
        const card = slim(raw);
        writeCache(k, card);
        result.set(k, card);
      } else {
        notFound.push([k, req]);
      }
    }
  }

  // Массовый запрос не знает флейвор-имён ("Fangorn Forest") и не прощает
  // неверный сет — для таких карт пробуем точный поиск по названию.
  for (const [k, req] of notFound) {
    const name = typeof req === 'string' ? req : req.name;
    if (!name) continue;
    await sleep(100);
    const raw = await fetchNamed(name);
    if (!raw) continue;
    const card = slim(raw);
    writeCache(k, card);
    result.set(k, card);
  }

  return result;
}

export function lookup(map, req) {
  return map.get(requestKey(req));
}

// "{2}{R}{R}" -> HTML с иконками символов маны
export function manaSymbols(cost) {
  if (!cost) return '';
  return cost.replace(/\{([^}]+)\}/g, (_, sym) => {
    const file = sym.replace(/\//g, '').toUpperCase();
    return `<img class="mana" src="https://svgs.scryfall.io/card-symbols/${file}.svg" alt="{${sym}}" title="{${sym}}" loading="lazy">`;
  });
}

// Кладёт конкретную печать в кэш (по id) и возвращает компактную версию
function remember(raw) {
  const card = slim(raw);
  writeCache(requestKey({ id: card.id }), card);
  return card;
}

/** Подсказки названий по мере ввода (как в строке поиска Scryfall). */
export async function autocomplete(query, signal) {
  if (query.trim().length < 2) return [];
  const res = await fetch(`${BASE}/cards/autocomplete?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) return [];
  return (await res.json()).data;
}

/** Точная карта по названию (понимает и флейвор-имена). */
export async function namedCard(name) {
  const raw = await fetchNamed(name);
  if (!raw) throw new Error(`Карта «${name}» не найдена`);
  return remember(raw);
}

/**
 * Полный поиск с синтаксисом Scryfall: "t:artifact o:token", "c:r cmc<=2" и т.д.
 * unique: 'cards' — по карте на название, 'prints' — все печати (для выбора арта).
 */
export async function searchCards(query, { unique = 'cards', order = 'name' } = {}) {
  const res = await fetch(`${BASE}/cards/search?q=${encodeURIComponent(query)}&unique=${unique}&order=${order}`);
  if (res.status === 404) return { cards: [], total: 0 };
  const json = await res.json();
  if (!res.ok) throw new Error(json.details || `Scryfall ответил ${res.status}`);
  return { cards: json.data.map(remember), total: json.total_cards };
}

/** Все печати карты — чтобы выбрать любимый арт. */
export const printingsOf = (card) =>
  searchCards(`oracleid:${card.oracleId} include:extras`, { unique: 'prints', order: 'released' });
