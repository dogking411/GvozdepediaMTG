// Сколько токенов даёт одно нажатие «Добавить» с учётом эффектов замены.
// Каждый эффект применяется к событию не больше одного раза, порядок выбирает игрок (правило 616.1),
// причём эффект, который пока не к чему применить (Bilbo без Еды), может сработать позже.
// Перебираем допустимые порядки и берём тот, что даёт больше всего токенов,
// при равенстве — более ровный (меньше сумма квадратов).

const KINDS = ['food', 'treasure', 'clue', 'mutagen', 'map'];

const total = (t) => KINDS.reduce((sum, k) => sum + t[k], 0);
const squares = (t) => KINDS.reduce((sum, k) => sum + t[k] * t[k], 0);
const plusOne = (kind) => (t) => ({ ...t, [kind]: t[kind] + 1 });

// Эффект получает создаваемые токены и возвращает новые либо null, если применить его не к чему
export const REPLACEMENTS = {
  // Academy Manufactor: каждая Улика, Еда и Сокровище становится одним токеном каждого из этих видов
  manufactors(t) {
    const n = t.food + t.treasure + t.clue;
    return n ? { ...t, food: n, treasure: n, clue: n } : null;
  },
  peregrin: plusOne('food'),
  tippyToe: plusOne('food'),
  donatello: plusOne('mutagen'),
  // Worldwalker Helm смотрит на артефактные токены, а других здесь нет
  helm: plusOne('map'),
  bilbo: (t) => (t.food ? { ...t, treasure: t.treasure + t.food } : null),
};

function better(a, b) {
  if (!b) return true;
  if (total(a) !== total(b)) return total(a) > total(b);
  return squares(a) < squares(b);
}

const cache = new Map(); // при удержании кнопки считается одно и то же

export function tokensCreated(kind, effects = {}) {
  const ids = Object.keys(REPLACEMENTS).filter((id) => effects[id]);
  const cacheKey = `${kind}|${ids.map((id) => `${id}${Number(effects[id])}`)}|${effects.doublers ?? 0}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const memo = new Map(); // разные порядки часто приводят к одному состоянию

  const solve = (t, left) => {
    const key = `${KINDS.map((k) => t[k])}|${left}`;
    if (memo.has(key)) return memo.get(key);
    let best = null;
    ids.forEach((id, i) => {
      if (!left[i]) return;
      const next = REPLACEMENTS[id](t);
      if (!next) return;
      const rest = [...left];
      rest[i]--;
      const result = solve(next, rest);
      if (better(result, best)) best = result;
    });
    memo.set(key, best ?? t);
    return best ?? t;
  };

  const start = Object.fromEntries(KINDS.map((k) => [k, k === kind ? 1 : 0]));
  const result = solve(start, ids.map((id) => Number(effects[id])));

  // Даблеры (Adrix and Nev, Parallel Lives и другие) выгоднее всего применять последними:
  // они удваивают всё, что добавили другие эффекты. В перебор их не включаем — вариантов слишком много.
  const factor = 2 ** (effects.doublers ?? 0);
  const doubled = Object.fromEntries(KINDS.map((k) => [k, result[k] * factor]));
  cache.set(cacheKey, doubled);
  return doubled;
}
