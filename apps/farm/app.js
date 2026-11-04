import { tokensCreated } from './rules.js';
import { icon } from './icons.js';

const THEME_KEY = 'gvozd:apps-theme';
const MAX_HISTORY = 200;

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

function vibrate(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* нет вибрации */
  }
}

const count = (v) => Math.max(0, Math.floor(Number(v)) || 0);

// ---- разметка ----

const stepperHtml = (e) => `
  <div class="stepper" data-effect="${e.id}" title="${e.title}">
    <button class="step" data-step="-1" aria-label="Меньше: ${e.label}">${icon('minus', 14)}</button>
    <span class="step-value"><span class="step-icon">${icon(e.icon, 15)}</span><span class="step-label">${e.label}</span><b>0</b></span>
    <button class="step" data-step="1" aria-label="Больше: ${e.label}">${icon('plus', 14)}</button>
  </div>`;

const toggleHtml = (e) =>
  `<button class="chip" data-effect="${e.id}" aria-pressed="false" title="${e.title}">${e.label}</button>`;

const panelHtml = (t) => `
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
      <div class="name">${icon(t.icon, 24)}<span>${t.name}</span></div>
      <div class="num" data-role="untapped">0</div>
      <div class="tapped" data-role="tapped">${icon('tap', 18)}<b>0</b></div>
    </div>
  </section>`;

const helpItem = ({ icon: name, letter, text }) =>
  `<li><span class="sheet-icon">${letter ?? icon(name, 15)}</span><span>${text}</span></li>`;

const COMMON_HELP = [
  { icon: 'plus', text: '<b>Верхняя левая</b> часть панели добавляет токен. Удерживайте, чтобы добавлять подряд.' },
  { icon: 'tap', text: '<b>Верхняя правая</b> тапает один токен.' },
  { icon: 'minus', text: '<b>Нижняя</b> часть убирает токен: сначала тапнутые, потом остальные.' },
  { icon: 'undo', text: '<b>Откат</b> в правом верхнем углу отменяет последнее действие, удержание целиком считается одним действием. На компьютере — Ctrl+Z.' },
  { icon: 'untap', text: '<b>Развернуть все</b> на верхней панели снимает тап со всех токенов.' },
];

function pageHtml({ title, tokens, effects, help }) {
  return `
    <header class="topbar ${effects.length > 3 ? 'stacked' : ''}">
      <div class="bar-group">
        <a class="tb-btn" href="../" title="Little Apps" aria-label="Все приложения">${icon('apps')}</a>
        <span class="title">${title}</span>
      </div>

      <div class="bar-group effects" aria-label="Эффекты на столе">
        ${effects.map((e) => (e.max ? stepperHtml(e) : toggleHtml(e))).join('')}
        <span class="yield" id="yield" hidden></span>
      </div>

      <div class="bar-group tools">
        <button class="tb-btn" id="untap" title="Развернуть все" aria-label="Развернуть все">${icon('untap')}</button>
        <button class="tb-btn" id="reset" title="Убрать все токены" aria-label="Убрать все токены">${icon('reset')}</button>
        <button class="tb-btn" id="wake" aria-pressed="false" hidden></button>
        <button class="tb-btn" id="theme"></button>
        <button class="tb-btn" id="help-btn" title="Как пользоваться" aria-label="Как пользоваться">${icon('help')}</button>
        <button class="tb-btn undo" id="undo" title="Откатить последнее действие (Ctrl+Z)" aria-label="Откатить последнее действие">${icon('undo')}</button>
      </div>
    </header>

    <main class="panels" id="panels" data-count="${tokens.length}" style="--cols: ${tokens.length}">
      ${tokens.map(panelHtml).join('')}
    </main>

    <dialog class="sheet" id="help">
      <h2>Как пользоваться</h2>
      <ul>${[...COMMON_HELP, ...help].map(helpItem).join('')}</ul>
      <form method="dialog"><button class="sheet-close">Понятно</button></form>
    </dialog>`;
}

// ---- приложение ----
// effects: { id, label, title } — переключатель, с max и icon — счётчик.

export function createFarm(config) {
  const { storageKey, tokens, effects, yieldLabel } = config;
  const helpKey = `${storageKey}-help`;

  document.querySelector('.app').innerHTML = pageHtml(config);

  const emptyCounts = () => Object.fromEntries(tokens.map((t) => [t.id, { untapped: 0, tapped: 0 }]));

  function loadState() {
    const state = { counts: emptyCounts() };
    for (const e of effects) state[e.id] = e.max ? 0 : false;
    try {
      const saved = JSON.parse(read(storageKey));
      if (!saved) return state;
      for (const { id } of tokens) {
        const c = saved.counts?.[id];
        if (c) state.counts[id] = { untapped: count(c.untapped), tapped: count(c.tapped) };
      }
      for (const e of effects) {
        state[e.id] = e.max ? Math.min(e.max, count(saved[e.id])) : saved[e.id] === true;
      }
    } catch {
      /* битое сохранение — начинаем с нуля */
    }
    return state;
  }

  const state = loadState();
  const save = () => write(storageKey, JSON.stringify(state));
  const created = (id) => tokensCreated(id, state);

  // ---- действия: возвращают true, если что-то изменилось ----

  function add(id) {
    for (const [kind, n] of Object.entries(created(id))) {
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
    for (const { id } of tokens) bump(id);
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

  function render() {
    for (const panel of panels.children) {
      const c = state.counts[panel.dataset.id];
      const num = panel.querySelector('[data-role="untapped"]');
      num.textContent = c.untapped;
      num.style.setProperty('--digits', String(c.untapped).length);
      const tapped = panel.querySelector('[data-role="tapped"]');
      tapped.querySelector('b').textContent = c.tapped;
      tapped.classList.toggle('zero', !c.tapped);
      panel.querySelector('.zone.tap').setAttribute('aria-disabled', String(!c.untapped));
      panel.querySelector('.zone.remove').setAttribute('aria-disabled', String(!c.untapped && !c.tapped));
    }

    for (const e of effects) {
      const el = document.querySelector(`[data-effect="${e.id}"]`);
      el.classList.toggle('on', Boolean(state[e.id]));
      if (e.max) {
        el.querySelector('b').textContent = state[e.id];
        el.querySelector('[data-step="-1"]').disabled = state[e.id] === 0;
        el.querySelector('[data-step="1"]').disabled = state[e.id] === e.max;
      } else {
        el.setAttribute('aria-pressed', String(state[e.id]));
      }
    }
    const label = yieldLabel(state, created);
    $('yield').hidden = !label;
    $('yield').textContent = label;

    $('undo').disabled = !history.length;
    $('untap').disabled = !Object.values(state.counts).some((c) => c.tapped);
    $('reset').disabled = !Object.values(state.counts).some((c) => c.tapped || c.untapped);
  }

  // ---- верхняя панель ----

  for (const e of effects) {
    const el = document.querySelector(`[data-effect="${e.id}"]`);
    if (e.max) {
      for (const button of el.querySelectorAll('[data-step]')) {
        button.addEventListener('click', () =>
          undoable(() => {
            const next = Math.min(e.max, Math.max(0, state[e.id] + Number(button.dataset.step)));
            if (next === state[e.id]) return false;
            state[e.id] = next;
            return true;
          }),
        );
      }
    } else {
      el.addEventListener('click', () =>
        undoable(() => {
          state[e.id] = !state[e.id];
          return true;
        }),
      );
    }
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
  help.addEventListener('close', () => write(helpKey, '1'));

  renderTheme();
  renderWake();
  render();
  if (!read(helpKey)) help.showModal();
}
