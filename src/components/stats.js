import { isLand } from '../lib/cardTypes.js';
import { manaSymbols } from '../lib/scryfall.js';
import { groupByType } from './decklist.js';

const COLORS = [
  { key: 'W', label: 'Белый' },
  { key: 'U', label: 'Синий' },
  { key: 'B', label: 'Чёрный' },
  { key: 'R', label: 'Красный' },
  { key: 'G', label: 'Зелёный' },
];

export function computeStats(entries, commanderCards) {
  const known = entries.filter((e) => e.card);
  const nonLand = known.filter((e) => !isLand(e.card));
  const qty = (list) => list.reduce((s, e) => s + e.qty, 0);

  const curve = Array.from({ length: 8 }, () => 0); // 0..6 и 7+
  let cmcSum = 0;
  for (const e of nonLand) {
    const cmc = Math.floor(e.card.cmc);
    curve[Math.min(cmc, 7)] += e.qty;
    cmcSum += e.card.cmc * e.qty;
  }

  // Символы маны в стоимости: гибриды считаются за оба цвета
  const pips = Object.fromEntries(COLORS.map((c) => [c.key, 0]));
  for (const e of [...known, ...commanderCards.map((card) => ({ qty: 1, card }))]) {
    for (const [, sym] of (e.card.manaCost || '').matchAll(/\{([^}]+)\}/g)) {
      for (const c of COLORS) if (sym.includes(c.key)) pips[c.key] += e.qty;
    }
  }

  const price = [...known.map((e) => (Number(e.card.prices) || 0) * e.qty), ...commanderCards.map((c) => Number(c.prices) || 0)]
    .reduce((a, b) => a + b, 0);

  return {
    total: qty(entries) + commanderCards.length,
    lands: qty(known) - qty(nonLand),
    avgCmc: qty(nonLand) ? cmcSum / qty(nonLand) : 0,
    curve,
    types: groupByType(known).map((g) => ({ label: g.label, count: g.count })),
    pips,
    price,
  };
}

export function renderStats(s) {
  const curveMax = Math.max(...s.curve, 1);
  const typeMax = Math.max(...s.types.map((t) => t.count), 1);
  const pipTotal = Object.values(s.pips).reduce((a, b) => a + b, 0);
  const pipMax = Math.max(...Object.values(s.pips), 1);

  return `
    <div class="kpis">
      <div class="kpi"><span class="kpi-value">${s.total}</span><span class="kpi-label">карт</span></div>
      <div class="kpi"><span class="kpi-value">${s.lands}</span><span class="kpi-label">земель</span></div>
      <div class="kpi"><span class="kpi-value">${s.avgCmc.toFixed(2)}</span><span class="kpi-label">ср. мана-стоимость</span></div>
      ${s.price ? `<div class="kpi"><span class="kpi-value">$${Math.round(s.price)}</span><span class="kpi-label">цена (Scryfall)</span></div>` : ''}
    </div>

    <h4>Мана-кривая <span class="muted">без земель</span></h4>
    <div class="curve" role="img" aria-label="Мана-кривая: ${s.curve.map((n, i) => `${i === 7 ? '7+' : i} — ${n}`).join(', ')}">
      ${s.curve
        .map(
          (n, i) => `
          <div class="curve-col" data-tip="${i === 7 ? '7+' : i} маны: ${n} карт">
            <span class="curve-value">${n || ''}</span>
            <div class="curve-bar" style="height:${(n / curveMax) * 100}%"></div>
            <span class="curve-label">${i === 7 ? '7+' : i}</span>
          </div>`,
        )
        .join('')}
    </div>

    <h4>Типы карт</h4>
    <div class="hbars">
      ${s.types
        .map(
          (t) => `
          <div class="hbar" data-tip="${t.label}: ${t.count}">
            <span class="hbar-label">${t.label}</span>
            <div class="hbar-track"><div class="hbar-fill" style="width:${(t.count / typeMax) * 100}%"></div></div>
            <span class="hbar-value">${t.count}</span>
          </div>`,
        )
        .join('')}
    </div>

    ${
      pipTotal
        ? `<h4>Цветные символы маны</h4>
    <div class="hbars">
      ${COLORS.filter((c) => s.pips[c.key])
        .map(
          (c) => `
          <div class="hbar" data-tip="${c.label}: ${s.pips[c.key]} (${Math.round((s.pips[c.key] / pipTotal) * 100)}%)">
            <span class="hbar-label">${manaSymbols(`{${c.key}}`)} ${c.label}</span>
            <div class="hbar-track"><div class="hbar-fill pip-${c.key}" style="width:${(s.pips[c.key] / pipMax) * 100}%"></div></div>
            <span class="hbar-value">${Math.round((s.pips[c.key] / pipTotal) * 100)}%</span>
          </div>`,
        )
        .join('')}
    </div>`
        : ''
    }
  `;
}
