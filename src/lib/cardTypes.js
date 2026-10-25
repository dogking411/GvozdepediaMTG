// Порядок важен: первая подходящая группа побеждает (Artifact Creature -> Creatures)
export const TYPE_GROUPS = [
  { key: 'Creature', label: 'Creatures' },
  // Земли сразу после существ: Urza's Saga (Enchantment Land) и Seat of the Synod (Artifact Land) — это земли
  { key: 'Land', label: 'Lands' },
  { key: 'Planeswalker', label: 'Planeswalkers' },
  { key: 'Battle', label: 'Battles' },
  { key: 'Instant', label: 'Instants' },
  { key: 'Sorcery', label: 'Sorceries' },
  { key: 'Artifact', label: 'Artifacts' },
  { key: 'Enchantment', label: 'Enchantments' },
];

export const OTHER_GROUP = { key: 'Other', label: 'Other' };

export function primaryType(card) {
  // У двусторонних карт смотрим на лицевую сторону
  const front = (card?.typeLine || '').split(' // ')[0];
  return TYPE_GROUPS.find((g) => front.includes(g.key)) || OTHER_GROUP;
}

export const isLand = (card) => primaryType(card).key === 'Land';
