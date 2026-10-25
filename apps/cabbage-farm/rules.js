// Сколько токенов даёт одно нажатие «Добавить» с учётом эффектов замены:
//   Academy Manufactor — вместо Clue, Food или Treasure создаётся по одному каждого;
//   Peregrin Took — к создаваемым токенам добавляется ещё одна Еда;
//   Bilbo, Fellow Conspirator — вместо Еды создаются Еда и Сокровище.
// Каждый эффект применяется к событию не больше одного раза, порядок выбирает игрок (правило 616.1),
// причём эффект, который пока не к чему применить (Bilbo без Еды), может сработать позже.
// Перебираем все допустимые порядки и берём тот, что даёт больше всего токенов,
// при равенстве — более ровный (больше минимум среди трёх видов).

const total = (t) => t.food + t.treasure + t.clue;

function better(a, b) {
  if (!b) return true;
  if (total(a) !== total(b)) return total(a) > total(b);
  return Math.min(a.food, a.treasure, a.clue) > Math.min(b.food, b.treasure, b.clue);
}

export function tokensCreated(kind, { manufactors = 0, peregrin = false, bilbo = false } = {}) {
  let best = null;

  const visit = (t, left) => {
    let applied = false;
    if (left.peregrin) {
      applied = true;
      visit({ ...t, food: t.food + 1 }, { ...left, peregrin: false });
    }
    if (left.bilbo && t.food > 0) {
      applied = true;
      visit({ ...t, treasure: t.treasure + t.food }, { ...left, bilbo: false });
    }
    if (left.manufactors > 0) {
      applied = true;
      const n = total(t);
      visit({ food: n, treasure: n, clue: n }, { ...left, manufactors: left.manufactors - 1 });
    }
    if (!applied && better(t, best)) best = t;
  };

  visit({ food: 0, treasure: 0, clue: 0, [kind]: 1 }, { manufactors, peregrin, bilbo });
  return best;
}
