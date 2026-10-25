import { tokensCreated } from './rules.js';
import { icon } from './icons.js';

const TOKENS = [
  { id: 'food', name: 'Еда', icon: 'cabbage' },
  { id: 'treasure', name: 'Сокровища', icon: 'treasure' },
  { id: 'clue', name: 'Улики', icon: 'clue' },
];
const MAX_MANUFACTORS = 5;
const STATE_KEY = 'gvozd:cabbage-farm';
const HELP_KEY = 'gvozd:cabbage-farm-help';
const THEME_KEY = 'gvozd:apps-theme';

const $ = (id) => document.getElementById(id);

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* без запоминания */
  }
}

const emptyCounts = () => Object.fromEntries(TOKENS.map((t) => [t.id, { untapped: 0, tapped: 0 }]));
const count = (v) => Math.max(0, Math.floor(Number(v)) || 0);

function loadState() {
  const state = { counts: emptyCounts(), manufactors: 0, peregrin: false, bilbo: false };
  try {
    const saved = JSON.parse(read(STATE_KEY));
    if (!saved) return state;
    for (const { id } of TOKENS) {
      const c = saved.counts?.[id];
      if (c) state.counts[id] = { untapped: count(c.untapped), tapped: count(c.tapped) };
    }
    state.manufactors = Math.min(MAX_MANUFACTORS, count(saved.manufactors));
    state.peregrin = saved.peregrin === true;
    state.bilbo = saved.bilbo === true;
  } catch {
    /* битое сохранение — начинаем с нуля */
  }
  return state;
}

const state = loadState();
const save = () => write(STATE_KEY, JSON.stringify(state));
const effects = () => ({ manufactors: state.manufactors, peregrin: state.peregrin, bilbo: state.bilbo });

function vibrate(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* нет вибрации */
  }
}

// ---- действия: возвращают true, если что-то изменилось ----

function add(id) {
  const created = tokensCreated(id, effects());
  for (const [kind, n] of Object.entries(created)) {
    if (!n) continue;
    state.counts[kind].untapped += n;
    bump(kind);
  }
  return true;
}

function tap(id) {
  const c = state.counts[id];
  if (!c.untapped) return false;
  c.untapped--;
  c.tapped++;
  bump(id);
  return true;
}

function remove(id) {
  const c = state.counts[id];
  if (c.tapped) c.tapped--;
  else if (c.untapped) c.untapped--;
  else return false;
  bump(id);
  return true;
}

function untapAll() {
  let changed = false;
  for (const c of Object.values(state.counts)) {
    if (!c.tapped) continue;
    c.untapped += c.tapped;
    c.tapped = 0;
    changed = true;
  }
  return changed;
}

function commit(changed, ms) {
  if (!changed) return false;
  save();
  render();
  vibrate(ms);
  return true;
}

// ---- откат: снимки состояния до каждого действия ----

const MAX_HISTORY = 200;
const history = [];
const snapshot = () => JSON.stringify(state);

function remember(before) {
  history.push(before);
  if (history.length > MAX_HISTORY) history.shift();
  $('undo').disabled = false;
}

// Действие одним шагом истории: если ничего не изменилось, шаг не записываем
function undoable(change, ms) {
  const before = snapshot();
  if (!change()) return false;
  remember(before);
  return commit(true, ms);
}

function undo() {
  if (!history.length) return false;
  Object.assign(state, JSON.parse(history.pop()));
  for (const { id } of TOKENS) bump(id);
  return commit(true, 12);
}

// ---- удержание: срабатывает сразу, потом повторяется всё быстрее ----
// Всё удержание — один шаг истории: откат вернёт состояние до нажатия.

function holdToRepeat(el, action) {
  let timer = 0;
  const stop = () => {
    clearTimeout(timer);
    timer = 0;
    el.classList.remove('holding');
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* без захвата */
    }
    stop();
    const before = snapshot();
    if (!action()) return;
    remember(before);
    let delay = 150;
    const tick = () => {
      if (!action()) return stop();
      el.classList.add('holding');
      delay = Math.max(60, delay * 0.9);
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 420);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, stop);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  // pointerdown гасит click, поэтому клавиатуру обрабатываем отдельно
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const before = snapshot();
    if (action()) remember(before);
  });
}

// ---- отрисовка ----

const panels = $('panels');

panels.innerHTML = TOKENS.map(
  (t) => `
  <section class="panel" data-id="${t.id}" style="--tone: var(--${t.id})" aria-label="${t.name}">
    <button type="button" class="zone add" data-action="add" aria-label="Добавить: ${t.name}">
      <span class="hint">${icon('plus', 13)}Добавить</span>
    </button>
    <button type="button" class="zone tap" data-action="tap" aria-label="Тапнуть: ${t.name}">
      <span class="hint">Тап${icon('tap', 13)}</span>
    </button>
    <button type="button" class="zone remove" data-action="remove" aria-label="Убрать: ${t.name}">
      <span class="hint">${icon('minus', 13)}Убрать</span>
    </button>
    <div class="face">
      <div class="name">${icon(t.icon, 26)}<span>${t.name}</span></div>
      <div class="num" data-role="untapped">0</div>
      <div class="tapped" data-role="tapped">${icon('tap', 18)}<b>0</b></div>
    </div>
  </section>`,
).join('');

const ACTIONS = { add, tap, remove };
for (const panel of panels.children) {
  for (const zone of panel.querySelectorAll('.zone')) {
    holdToRepeat(zone, () => commit(ACTIONS[zone.dataset.action](panel.dataset.id)));
  }
}

const bumpTimers = {};
function bump(id) {
  const num = panels.querySelector(`[data-id="${id}"] .num`);
  num.classList.remove('bump');
  void num.offsetWidth; // перезапуск анимации при частых нажатиях
  num.classList.add('bump');
  clearTimeout(bumpTimers[id]);
  bumpTimers[id] = setTimeout(() => num.classList.remove('bump'), 180);
}

// Что даёт одно «Добавить» при текущих эффектах — подпись рядом с переключателями
function yieldLabel() {
  if (state.manufactors) {
    const amounts = TOKENS.flatMap((t) => Object.values(tokensCreated(t.id, effects())));
    const lo = Math.min(...amounts);
    const hi = Math.max(...amounts);
    return lo === hi ? `×${lo} каждого` : `×${lo}–${hi} каждого`;
  }
  const extras = [];
  if (state.peregrin) extras.push('+1 Еда');
  if (state.bilbo) extras.push('Еда → +Сокровище');
  return extras.join(' · ');
}

function render() {
  for (const panel of panels.children) {
    const c = state.counts[panel.dataset.id];
    panel.querySelector('[data-role="untapped"]').textContent = c.untapped;
    const tapped = panel.querySelector('[data-role="tapped"]');
    tapped.querySelector('b').textContent = c.tapped;
    tapped.classList.toggle('zero', !c.tapped);
    panel.querySelector('.zone.tap').setAttribute('aria-disabled', String(!c.untapped));
    panel.querySelector('.zone.remove').setAttribute('aria-disabled', String(!c.untapped && !c.tapped));
  }

  $('mfg').classList.toggle('on', state.manufactors > 0);
  $('mfg-count').textContent = state.manufactors;
  $('mfg-minus').disabled = state.manufactors === 0;
  $('mfg-plus').disabled = state.manufactors === MAX_MANUFACTORS;
  for (const id of ['peregrin', 'bilbo']) {
    $(id).classList.toggle('on', state[id]);
    $(id).setAttribute('aria-pressed', String(state[id]));
  }
  const label = yieldLabel();
  $('yield').hidden = !label;
  $('yield').textContent = label;

  $('undo').disabled = !history.length;
  $('untap').disabled = !Object.values(state.counts).some((c) => c.tapped);
  $('reset').disabled = !Object.values(state.counts).some((c) => c.tapped || c.untapped);
}

// ---- верхняя панель ----

$('home').innerHTML = icon('apps');
$('mfg-icon').innerHTML = icon('gear', 15);
$('mfg-minus').innerHTML = icon('minus', 14);
$('mfg-plus').innerHTML = icon('plus', 14);
$('untap').innerHTML = icon('untap');
$('reset').innerHTML = icon('reset');
$('help-btn').innerHTML = icon('help');
$('undo').innerHTML = icon('undo');
for (const el of document.querySelectorAll('.sheet-icon[data-icon]')) el.innerHTML = icon(el.dataset.icon, 15);

function setManufactors(n) {
  const next = Math.min(MAX_MANUFACTORS, Math.max(0, n));
  undoable(() => {
    if (next === state.manufactors) return false;
    state.manufactors = next;
    return true;
  });
}
$('mfg-minus').addEventListener('click', () => setManufactors(state.manufactors - 1));
$('mfg-plus').addEventListener('click', () => setManufactors(state.manufactors + 1));
for (const id of ['peregrin', 'bilbo']) {
  $(id).addEventListener('click', () =>
    undoable(() => {
      state[id] = !state[id];
      return true;
    }),
  );
}
$('untap').addEventListener('click', () => undoable(untapAll, 16));
$('reset').addEventListener('click', () => {
  if (!confirm('Убрать все токены?')) return;
  undoable(() => {
    state.counts = emptyCounts();
    return true;
  }, 20);
});
$('undo').addEventListener('click', undo);
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyZ') {
    e.preventDefault();
    undo();
  }
});

// ---- тема: по системе, пока пользователь не выбрал сам ----

const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => {
  const forced = document.documentElement.dataset.theme;
  return forced ? forced === 'dark' : darkQuery.matches;
};
function renderTheme() {
  const dark = isDark();
  $('theme').innerHTML = icon(dark ? 'sun' : 'moon');
  $('theme').title = dark ? 'Светлая тема' : 'Тёмная тема';
  $('theme').setAttribute('aria-label', $('theme').title);
}
$('theme').addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  write(THEME_KEY, next);
  renderTheme();
});
darkQuery.addEventListener('change', renderTheme);

// ---- не гасить экран (Screen Wake Lock API) ----

let wakeWanted = false;
let wakeLock = null;

function renderWake() {
  $('wake').innerHTML = icon(wakeWanted ? 'awake' : 'sleep');
  $('wake').classList.toggle('on', wakeWanted);
  $('wake').setAttribute('aria-pressed', String(wakeWanted));
  $('wake').title = wakeWanted ? 'Экран не гаснет — нажмите, чтобы отключить' : 'Не гасить экран';
  $('wake').setAttribute('aria-label', $('wake').title);
}

async function acquireWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => (wakeLock = null));
  } catch {
    wakeWanted = false; // браузер отказал
  }
  renderWake();
}

if ('wakeLock' in navigator) {
  $('wake').hidden = false;
  $('wake').addEventListener('click', () => {
    wakeWanted = !wakeWanted;
    if (wakeWanted) acquireWakeLock();
    else wakeLock?.release();
    renderWake();
  });
  // Система снимает блокировку, когда вкладка уходит в фон — возвращаем её
  document.addEventListener('visibilitychange', () => {
    if (wakeWanted && !wakeLock && document.visibilityState === 'visible') acquireWakeLock();
  });
}

// ---- справка ----

const help = $('help');
$('help-btn').addEventListener('click', () => help.showModal());
help.addEventListener('click', (e) => {
  if (e.target === help) help.close(); // клик по фону
});
help.addEventListener('close', () => write(HELP_KEY, '1'));

renderTheme();
renderWake();
render();
if (!read(HELP_KEY)) help.showModal();
