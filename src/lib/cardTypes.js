// Группы в порядке показа — как на Moxfield (группа Commander добавляется в деклисте отдельно)
export const TYPE_GROUPS = [
  { key: 'Planeswalker', label: 'Planeswalkers' },
  { key: 'Battle', label: 'Battles' },
  { key: 'Creature', label: 'Creatures' },
  { key: 'Sorcery', label: 'Sorceries' },
  { key: 'Instant', label: 'Instants' },
  { key: 'Artifact', label: 'Artifacts' },
  { key: 'Enchantment', label: 'Enchantments' },
  { key: 'Land', label: 'Lands' },
];

export const OTHER_GROUP = { key: 'Other', label: 'Other' };

// Порядок проверки, если у карты несколько типов (тоже как на Moxfield):
// Dryad Arbor (Land Creature) и Urza's Saga (Enchantment Land) — земли, Artifact Creature — существо
const PRIORITY = ['Land', 'Creature', 'Planeswalker', 'Battle', 'Instant', 'Sorcery', 'Artifact', 'Enchantment'];

export function primaryType(card) {
  // У двусторонних карт смотрим на лицевую сторону; подтипы после «—» не учитываем
  const types = (card?.typeLine || '').split(' // ')[0].split('—')[0].split(/\s+/);
  const key = PRIORITY.find((t) => types.includes(t));
  return TYPE_GROUPS.find((g) => g.key === key) || OTHER_GROUP;
}

export const isLand = (card) => primaryType(card).key === 'Land';
