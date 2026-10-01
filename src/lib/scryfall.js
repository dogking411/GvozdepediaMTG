// Загрузка данных о картах со Scryfall (https://scryfall.com/docs/api)
// с кэшем в localStorage, чтобы не дёргать API при каждом открытии страницы.

const API = 'https://api.scryfall.com/cards/collection';
const BATCH = 75; // лимит Scryfall на один запрос
const CACHE_PREFIX = 'gvozd:card:v1:';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const memory = new Map();
const key = (name) => name.toLowerCase().split(' // ')[0].trim();

function readCache(name) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key(name));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.t > CACHE_TTL) return null;
    return entry.c;
  } catch {
    return null;
  }
}

function writeCache(card) {
  try {
    localStorage.setItem(CACHE_PREFIX + key(card.name), JSON.stringify({ t: Date.now(), c: card }));
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
    name: card.name,
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
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Возвращает Map<lowercase-имя, карта> для переданных имён.
 * Ненайденные карты в Map не попадают.
 */
export async function fetchCards(names) {
  const result = new Map();
  const missing = [];

  for (const name of new Set(names)) {
    const k = key(name);
    const cached = memory.get(k) || readCache(name);
    if (cached) {
      memory.set(k, cached);
      result.set(k, cached);
    } else {
      missing.push(name);
    }
  }

  for (let i = 0; i < missing.length; i += BATCH) {
    if (i > 0) await sleep(100); // вежливая пауза между запросами
    const identifiers = missing.slice(i, i + BATCH).map((n) => ({ name: n.split(' // ')[0] }));
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identifiers }),
    });
    if (!res.ok) throw new Error(`Scryfall ответил ${res.status}`);
    const json = await res.json();
    for (const raw of json.data) {
      const card = slim(raw);
      memory.set(key(card.name), card);
      result.set(key(card.name), card);
      writeCache(card);
    }
  }

  return result;
}

export function lookup(map, name) {
  return map.get(key(name));
}

// "{2}{R}{R}" -> HTML с иконками символов маны
export function manaSymbols(cost) {
  if (!cost) return '';
  return cost.replace(/\{([^}]+)\}/g, (_, sym) => {
    const file = sym.replace(/\//g, '').toUpperCase();
    return `<img class="mana" src="https://svgs.scryfall.io/card-symbols/${file}.svg" alt="{${sym}}" title="{${sym}}" loading="lazy">`;
  });
}
