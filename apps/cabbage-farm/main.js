import { createFarm } from '../farm/app.js';

const TOKENS = [
  { id: 'food', name: 'Еда', icon: 'cabbage' },
  { id: 'treasure', name: 'Сокровища', icon: 'treasure' },
  { id: 'clue', name: 'Улики', icon: 'clue' },
];

createFarm({
  title: 'CabbageFarm',
  storageKey: 'gvozd:cabbage-farm',
  tokens: TOKENS,
  effects: [
    { id: 'manufactors', label: 'Manufactor', icon: 'gear', max: 5, title: 'Сколько Academy Manufactor под вашим контролем' },
    { id: 'peregrin', label: 'Peregrin', title: 'Peregrin Took: каждое создание токенов даёт ещё одну Еду' },
    { id: 'bilbo', label: 'Bilbo', title: 'Bilbo, Fellow Conspirator: каждая Еда приносит ещё и Сокровище' },
  ],
  help: [
    { icon: 'gear', text: '<b>Academy Manufactor</b>: укажите, сколько их у вас. Каждое создание токена превращается в 3<sup>n−1</sup> токенов <em>каждого</em> вида: 1 при одном, 3 при двух, 9 при трёх.' },
    { letter: 'P', text: '<b>Peregrin Took</b>: включите, пока он на столе, — каждое добавление даёт ещё и Еду. С Manufactor эта Еда тоже размножается: 2 каждого при одном, 6 при двух.' },
    { letter: 'B', text: '<b>Bilbo</b>: включите, пока он на столе, — каждая созданная Еда приносит Сокровище. Эффекты применяются в том порядке, который даёт больше всего токенов.' },
  ],
  // Что даёт одно «Добавить» при текущих эффектах
  yieldLabel(state, created) {
    if (state.manufactors) {
      const amounts = TOKENS.flatMap((t) => TOKENS.map((kind) => created(t.id)[kind.id]));
      const lo = Math.min(...amounts);
      const hi = Math.max(...amounts);
      return lo === hi ? `×${lo} каждого` : `×${lo}–${hi} каждого`;
    }
    const extras = [];
    if (state.peregrin) extras.push('+1 Еда');
    if (state.bilbo) extras.push('Еда → +Сокровище');
    return extras.join(' · ');
  },
});
