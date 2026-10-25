// Порядок важен: первая подходящая группа побеждает (Artifact Creature -> Существа)
export const TYPE_GROUPS = [
  { key: 'Creature', label: 'Существа' },
  // Земли сразу после существ: Urza's Saga (Enchantment Land) и Seat of the Synod (Artifact Land) — это земли
  { key: 'Land', label: 'Земли' },
  { key: 'Planeswalker', label: 'Планесволкеры' },
  { key: 'Battle', label: 'Битвы' },
  { key: 'Instant', label: 'Мгновенные' },
  { key: 'Sorcery', label: 'Волшебство' },
  { key: 'Artifact', label: 'Артефакты' },
  { key: 'Enchantment', label: 'Чары' },
];

export const OTHER_GROUP = { key: 'Other', label: 'Прочее' };

export function primaryType(card) {
  // У двусторонних карт смотрим на лицевую сторону
  const front = (card?.typeLine || '').split(' // ')[0];
  return TYPE_GROUPS.find((g) => front.includes(g.key)) || OTHER_GROUP;
}

export const isLand = (card) => primaryType(card).key === 'Land';
