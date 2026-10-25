// Разбор файла колоды из content/decks/*.md
//
// Формат:
//   ---
//   name: Название колоды
//   commander: Krenko, Mob Boss
//   moxfield: https://moxfield.com/decks/...
//   ---
//   ## Праймер
//   ...markdown...
//   ## Мысли о колоде
//   ...markdown...
//   ## Деклист
//   1 Sol Ring
//   ...
//   ## Sideboard          (необязательно: карты, о которых думаю / которые тестирую)
//   1 Damping Sphere # заметка после решётки

const SECTION_KEYS = {
  'праймер': 'primer',
  'мысли о колоде': 'thoughts',
  'мысли': 'thoughts',
  'деклист': 'decklist',
  'sideboard': 'sideboard',
  'сайдборд': 'sideboard',
};

export function parseDeckFile(raw, slug) {
  const text = raw.replace(/\r\n/g, '\n');
  const meta = {};
  let body = text;

  const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    body = text.slice(fm[0].length);
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^\s*([\w-]+)\s*:\s*(.*)$/);
      if (m) meta[m[1]] = m[2].trim();
    }
  }

  const sections = { primer: '', thoughts: '', decklist: '', sideboard: '' };
  let current = null;
  for (const line of body.split('\n')) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    // Незнакомый заголовок "## ..." остаётся частью текущей секции
    if (h && SECTION_KEYS[h[1].toLowerCase()]) {
      current = SECTION_KEYS[h[1].toLowerCase()];
      continue;
    }
    if (current) sections[current] += line + '\n';
  }

  // Командиров может быть два (партнёры): "commander: A | B"
  const commanders = (meta.commander || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    slug,
    name: meta.name || slug,
    commanders,
    moxfield: meta.moxfield || '',
    date: meta.date || '',
    primer: sections.primer.trim(),
    thoughts: sections.thoughts.trim(),
    decklistText: sections.decklist.trim(),
    sideboardText: sections.sideboard.trim(),
    sideboard: parseDecklistLines(sections.sideboard),
    cards: parseDecklist(sections.decklist, commanders),
    commanderEntries: commanders.map(
      (name) => parseDecklistLines(sections.decklist).find((c) => c.name.toLowerCase() === name.toLowerCase()) || { name },
    ),
  };
}

// Поддерживает экспорт Moxfield/Archidekt:
//   "1 Sol Ring", "1x Sol Ring", "1 Sol Ring (CMM) 400", "1 Sol Ring (CMM) 400 *F*"
// и заметку в конце строки: "1 Sol Ring # почему эта карта здесь"
export function parseDecklist(text, commanders = []) {
  const skip = new Set(commanders.map((c) => c.toLowerCase()));
  return parseDecklistLines(text).filter((c) => !skip.has(c.name.toLowerCase()));
}

// Все строки деклиста, включая командира
export function parseDecklistLines(text) {
  const cards = [];
  for (let line of text.split('\n')) {
    line = line.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;
    const noteMatch = line.match(/\s+#\s*(.*)$/);
    const note = noteMatch ? noteMatch[1].trim() : '';
    if (noteMatch) line = line.slice(0, noteMatch.index);
    const m = line.match(/^(\d+)x?\s+(.+?)(?:\s+\(([A-Za-z0-9]+)\)(?:\s+([^\s*]+))?)?(?:\s+\*[A-Z]+\*)*$/);
    if (!m) continue;
    const name = m[2].trim();
    const existing = cards.find((c) => c.name === name);
    if (existing) existing.qty += Number(m[1]);
    else cards.push({ qty: Number(m[1]), name, ...(m[3] ? { set: m[3], number: m[4] || '' } : {}), ...(note ? { note } : {}) });
  }
  return cards;
}

// Обратная операция: поля формы редактора -> текст файла колоды
export function serializeDeck({ name, commanders, moxfield, primer, thoughts, decklistText, sideboardText = '' }) {
  const line = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();
  const meta = [`name: ${line(name)}`, `commander: ${commanders.map(line).filter(Boolean).join(' | ')}`];
  if (line(moxfield)) meta.push(`moxfield: ${line(moxfield)}`);
  return [
    '---',
    ...meta,
    '---',
    '',
    '## Праймер',
    '',
    primer.trim(),
    '',
    '## Мысли о колоде',
    '',
    thoughts.trim(),
    '',
    '## Деклист',
    '',
    decklistText.trim(),
    '',
    ...(sideboardText.trim() ? ['## Sideboard', '', sideboardText.trim(), ''] : []),
  ].join('\n');
}
