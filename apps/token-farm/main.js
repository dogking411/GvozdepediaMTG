import { createFarm } from '../farm/app.js';

const TOKENS = [
  { id: 'food', name: 'Еда', icon: 'cabbage' },
  { id: 'treasure', name: 'Сокровища', icon: 'treasure' },
  { id: 'clue', name: 'Улики', icon: 'clue' },
  { id: 'mutagen', name: 'Мутагены', icon: 'mutagen' },
  { id: 'map', name: 'Карты', icon: 'map' },
];

createFarm({
  title: 'Token Farm',
  storageKey: 'gvozd:token-farm',
  tokens: TOKENS,
  effects: [
    { id: 'manufactors', label: 'Manufactor', icon: 'gear', max: 5, title: 'Сколько Academy Manufactor под вашим контролем' },
    { id: 'doublers', label: 'Даблеры', icon: 'doubler', max: 5, title: 'Удвоители токенов: Adrix and Nev, Twincasters, Parallel Lives и другие' },
    { id: 'peregrin', label: 'Peregrin', title: 'Peregrin Took: каждое создание токенов даёт ещё одну Еду' },
    { id: 'tippyToe', label: 'Tippy-Toe', title: 'Tippy-Toe, Terrific Partner: каждое создание токенов даёт ещё одну Еду' },
    { id: 'donatello', label: 'Donatello', title: 'Donatello, the Brains: каждое создание токенов даёт ещё один Мутаген' },
    { id: 'helm', label: 'Helm', title: 'Worldwalker Helm: каждое создание артефактных токенов даёт ещё одну Карту' },
    { id: 'bilbo', label: 'Bilbo', title: 'Bilbo, Fellow Conspirator: каждая Еда приносит ещё и Сокровище' },
  ],
  help: [
    { icon: 'gear', text: '<b>Academy Manufactor</b>: укажите, сколько их у вас. Каждая Еда, Сокровище и Улика превращается в токены всех трёх видов. Мутагены и Карты он не меняет.' },
    { icon: 'doubler', text: '<b>Даблеры</b>: укажите, сколько у вас удвоителей (Adrix and Nev, Twincasters, Parallel Lives и другие). Каждый удваивает все токены.' },
    { letter: 'P', text: '<b>Peregrin Took</b> и <b>Tippy-Toe</b>: включите, пока они на столе, — каждое добавление даёт ещё и Еду.' },
    { letter: 'D', text: '<b>Donatello</b>: включите, пока он на столе, — каждое добавление даёт ещё и Мутаген.' },
    { letter: 'H', text: '<b>Worldwalker Helm</b>: включите, пока он на столе, — каждое добавление даёт ещё и Карту.' },
    { letter: 'B', text: '<b>Bilbo</b>: включите, пока он на столе, — каждая созданная Еда приносит Сокровище.' },
    { icon: 'plus', text: 'Эффекты применяются в том порядке, который даёт больше всего токенов.' },
  ],
  // Сколько всего токенов даёт одно «Добавить» при текущих эффектах
  yieldLabel(state, created) {
    const totals = TOKENS.map((t) => Object.values(created(t.id)).reduce((sum, n) => sum + n, 0));
    const lo = Math.min(...totals);
    const hi = Math.max(...totals);
    if (hi === 1) return '';
    return lo === hi ? `За нажатие: +${lo}` : `За нажатие: +${lo}–${hi}`;
  },
});
