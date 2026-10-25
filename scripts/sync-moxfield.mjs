// Синхронизация колоды с Moxfield. Запускается в GitHub Actions (.github/workflows/sync-moxfield.yml)
// на компьютере редактора (self-hosted runner) — с серверов GitHub Moxfield запросы не пускает:
//   node scripts/sync-moxfield.mjs <slug> [--commit]      (slug можно передать и через переменную SLUG)
// --commit — закоммитить и запушить изменения, записать changed=true/false в GITHUB_OUTPUT.
// Забирает Mainboard, Sideboard и командира по ссылке moxfield из content/decks/<slug>.md
// и перезаписывает только состав колоды — праймер, мысли и заметки к Sideboard сохраняются.

import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseDeckFile, parseDecklist, parseDecklistLines, serializeDeck } from '../src/lib/deckFile.js';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--')) || process.env.SLUG || '';
const shouldCommit = args.includes('--commit');
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail(`Некорректный адрес колоды: "${slug}"`);

const path = `content/decks/${slug}.md`;
let raw;
try {
  raw = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
} catch {
  fail(`Файл ${path} не найден`);
}
const deck = parseDeckFile(raw, slug);

const publicId = deck.moxfield.match(/moxfield\.com\/decks\/([A-Za-z0-9_-]+)/)?.[1];
if (!publicId) fail('У колоды не указана ссылка на Moxfield — добавь её в редакторе колоды.');

// Честно представляемся: Moxfield пропускает запросы, которые говорят, кто они
const [owner, repo] = (process.env.GITHUB_REPOSITORY || 'dogking411/GvozdepediaMTG').split('/');
const USER_AGENT = `GvozdepediaMTG/1.0 (+https://${owner}.github.io/${repo}/; github.com/${owner})`;

// Через curl: Cloudflare перед Moxfield отклоняет встроенный fetch из Node.js (403), а curl пропускает
let output;
try {
  output = execFileSync('curl', [
    '-sS', '--max-time', '30', '-w', '\n%{http_code}',
    '-H', `User-Agent: ${USER_AGENT}`,
    '-H', 'Accept: application/json',
    `https://api2.moxfield.com/v3/decks/all/${publicId}`,
  ], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
} catch (err) {
  fail(`Не удалось связаться с Moxfield: ${err.message}`);
}
const status = Number(output.slice(output.lastIndexOf('\n') + 1));
if (status === 404) fail('Moxfield: колода не найдена. Она публичная? Ссылка верная?');
if (status !== 200) fail(`Moxfield ответил ${status}${status === 403 ? ' — запрос с сервера GitHub заблокирован' : ''}`);
const mox = JSON.parse(output.slice(0, output.lastIndexOf('\n')));

// "1 Fangorn Forest (LTC) 377" — как в текстовом экспорте Moxfield: альтернативное имя, если есть,
// двусторонние карты через " / " и точная печать
const shownName = (e, useFlavor = true) => ((useFlavor && e.card.flavor_name) || e.card.name).replace(/\s+\/\/\s+/g, ' / ');
const finishMark = (e) => (e.finish === 'foil' ? ' *F*' : e.finish === 'etched' ? ' *E*' : '');
const line = (e, { useFlavor = true } = {}) =>
  `${e.quantity} ${shownName(e, useFlavor)} (${e.card.set.toUpperCase()}) ${e.card.cn}${finishMark(e)}`;
const boardEntries = (name) =>
  Object.values(mox.boards?.[name]?.cards || {}).sort((a, b) => shownName(a).localeCompare(shownName(b)));

const commanderEntries = boardEntries('commanders');
const commanders = commanderEntries.length ? commanderEntries.map((e) => e.card.name) : deck.commanders;
const decklistText = [
  ...commanderEntries.map((e) => line(e, { useFlavor: false })), // имя командира должно совпадать с полем commander
  ...boardEntries('mainboard').map((e) => line(e)),
].join('\n');

// Заметки к картам Sideboard (после #) переносим на те же карты
const notes = new Map(deck.sideboard.filter((c) => c.note).map((c) => [c.name.toLowerCase(), c.note]));
const sideboardText = boardEntries('sideboard')
  .map((e) => {
    const note = notes.get((e.card.flavor_name || '').toLowerCase()) || notes.get(e.card.name.toLowerCase());
    return note ? `${line(e)} # ${note}` : line(e);
  })
  .join('\n');

const text = serializeDeck({ ...deck, commanders, decklistText, sideboardText });

// Короткий отчёт: что поменялось в основной колоде
const byName = (list) => new Map(list.map((c) => [c.name.toLowerCase(), c]));
const before = byName(parseDecklist(deck.decklistText, deck.commanders));
const after = byName(parseDecklist(decklistText, commanders));
const added = [...after.values()].filter((c) => !before.has(c.name.toLowerCase()));
const removed = [...before.values()].filter((c) => !after.has(c.name.toLowerCase()));
const sideCount = parseDecklistLines(sideboardText).reduce((s, c) => s + c.qty, 0);

const report = [
  `### ${deck.name}`,
  text.trim() === raw.trim() ? 'Изменений нет — колода уже совпадает с Moxfield.' : 'Колода обновлена.',
  `Добавлено: ${added.length ? added.map((c) => c.name).join(', ') : '—'}`,
  `Убрано: ${removed.length ? removed.map((c) => c.name).join(', ') : '—'}`,
  `Sideboard: ${sideCount} карт`,
].join('\n\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');

writeFileSync(path, text);

if (shouldCommit) {
  const changed = text.trim() !== raw.trim();
  if (changed) {
    const git = (...a) => execFileSync('git', a, { stdio: 'inherit' });
    git('config', 'user.name', 'github-actions[bot]');
    git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
    git('commit', '-am', `Синхронизация с Moxfield: ${deck.name}`);
    git('push');
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
}

function fail(message) {
  console.error(`::error::${message}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `❌ ${message}\n`);
  process.exit(1);
}
