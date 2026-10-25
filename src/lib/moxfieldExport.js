import { parseDecklist, parseDecklistLines } from './deckFile.js';

// Разбор текста, скопированного из Moxfield (More → Export).
// Понимает заголовки разделов разных форматов экспорта:
//   "Commander", "Deck", "Sideboard", "SIDEBOARD:", "Maybeboard", "Considering", "Companion"
const HEADERS = [
  [/^(commanders?|командиры?)$/, 'commander'],
  [/^(deck|main|mainboard|колода|деклист)$/, 'main'],
  [/^(sideboard|maybeboard|considering|companions?|сайдборд)$/, 'side'],
];

export function parseExport(text) {
  const out = { commander: [], main: [], side: [], hasSide: false };
  let current = 'main';
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^\d/.test(line)) {
      out[current].push(line);
      continue;
    }
    const header = line.replace(/^(\/\/|#)\s*/, '').replace(/[:\s]+$/, '').toLowerCase();
    const found = HEADERS.find(([re]) => re.test(header));
    if (found) {
      current = found[1];
      if (current === 'side') out.hasSide = true;
    }
  }
  return out;
}

const byName = (list) => new Map(list.map((c) => [c.name.toLowerCase(), c]));

/**
 * Сравнивает текущую колоду с экспортом и готовит новые тексты разделов.
 * Заметки к картам Sideboard сохраняются; если в экспорте нет Sideboard — он не трогается.
 */
export function planSync(deck, exportText) {
  const exp = parseExport(exportText);
  const exportCommanders = parseDecklistLines(exp.commander.join('\n')).map((c) => c.name);
  const commanders = exportCommanders.length ? exportCommanders : deck.commanders;

  const decklistText = [...exp.commander, ...exp.main].join('\n');
  const oldMain = byName(parseDecklist(deck.decklistText, deck.commanders));
  const newMain = byName(parseDecklist(decklistText, commanders));

  const added = [];
  const removed = [];
  const changed = [];
  for (const [k, c] of newMain) {
    const old = oldMain.get(k);
    if (!old) added.push(c);
    else if (old.qty !== c.qty) changed.push({ ...c, from: old.qty });
  }
  for (const [k, c] of oldMain) if (!newMain.has(k)) removed.push(c);

  let sideboardText = deck.sideboardText;
  if (exp.hasSide) {
    const oldNotes = byName(deck.sideboard);
    sideboardText = exp.side
      .map((line) => {
        if (/\s#\s*/.test(line)) return line;
        const [card] = parseDecklistLines(line);
        const note = card && oldNotes.get(card.name.toLowerCase())?.note;
        return note ? `${line} # ${note}` : line;
      })
      .join('\n');
  }

  return {
    commanders,
    commandersChanged: commanders.join('|').toLowerCase() !== deck.commanders.join('|').toLowerCase(),
    decklistText,
    sideboardText,
    sideboardFromExport: exp.hasSide,
    mainCount: [...newMain.values()].reduce((s, c) => s + c.qty, 0) + commanders.length,
    sideCount: parseDecklistLines(sideboardText).reduce((s, c) => s + c.qty, 0),
    added,
    removed,
    changed,
    printingsChanged: decklistText.trim() !== deck.decklistText.trim() && !added.length && !removed.length && !changed.length,
    empty: newMain.size === 0,
  };
}
