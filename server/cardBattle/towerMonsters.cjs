const MONSTERS = [
  ['slime', 'Slime', 'Vitality'],
  ['goblin', 'Goblin', 'Agility'],
  ['skeleton', 'Skeleton', 'Strength'],
  ['werewolf', 'Werewolf', 'Agility'],
  ['orc', 'Orc', 'Strength'],
  ['giant-bat', 'Giant Bat', 'Agility'],
  ['troll', 'Troll', 'Vitality'],
  ['kobold', 'Kobold', 'Agility'],
  ['zombie', 'Zombie', 'Vitality'],
  ['lizardman', 'Lizardman', 'Strength'],
  ['harpy', 'Harpy', 'Agility'],
  ['minotaur', 'Minotaur', 'Strength'],
  ['ogre', 'Ogre', 'Vitality'],
  ['wraith', 'Wraith', 'Arcane'],
  ['cyclops', 'Cyclops', 'Strength'],
  ['gargoyle', 'Gargoyle', 'Vitality'],
  ['golem', 'Golem', 'Vitality'],
  ['giant-spider', 'Giant Spider', 'Agility'],
  ['ghoul', 'Ghoul', 'Arcane'],
  ['griffin', 'Griffin', 'Agility'],
];

// Tower monsters use an existing, fully validated move set as their combat
// template. Their identity, stats and artwork remain completely separate from
// collectible cards.
const MOVE_TEMPLATE = 'variant-681a1aec-dc78-4c97-944c-9da814271781';
const byId = new Map(MONSTERS.map(([slug, name, type], index) => {
  const tier = Math.floor(index / 4);
  const card = {
    id: `tower-monster:${slug}`,
    name,
    series: 'Card Tower',
    type,
    rarity: 'Common',
    sprite: `monsters/normal/normal-${slug}.png`,
    towerMonster: true,
    moveTemplate: MOVE_TEMPLATE,
    baseStats: {
      HP: 82 + tier * 9 + (type === 'Vitality' ? 10 : 0),
      ATK: 15 + tier * 2 + (type === 'Strength' ? 3 : 0),
      DEF: 12 + tier * 2 + (type === 'Vitality' ? 3 : 0),
      SPD: 13 + tier * 2 + (type === 'Agility' ? 4 : 0),
      ARC: 13 + tier * 2 + (type === 'Arcane' ? 4 : 0),
      CRT: 8 + tier,
    },
    mergeTarget: null,
  };
  return [card.id, Object.freeze(card)];
}));

function get(id) {
  const monster = byId.get(id);
  if (!monster) throw Error('Unknown tower monster');
  return structuredClone(monster);
}

module.exports = {
  get,
  has: id => byId.has(id),
  list: () => [...byId.values()].map(monster => structuredClone(monster)),
  moveTemplate: id => get(id).moveTemplate,
};
