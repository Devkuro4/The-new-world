const fs = require('node:fs');
const path = require('node:path');
const cards = require('./characters.json');
const types = ['Strength','Agility','Arcane','Vitality'];
const rarities = ['Common','Uncommon','Rare','Epic','Legendary','Mythical','Celestial'];
const byId = new Map(cards.map(c => [c.id,c]));
const matchups = [[1,.5,1.5,.5],[1.5,1,.5,1.5],[.5,1.5,1,1.5],[1.5,.5,.5,1]];
function multiplier(a,b){if(!types.includes(a)||!types.includes(b))throw Error('Unknown type');return matchups[types.indexOf(a)][types.indexOf(b)];}
function getCard(id){const c=byId.get(id);if(!c)throw Error('Unknown card');return structuredClone(c);}
function statsAt(id,level){if(!Number.isInteger(level)||level<1||level>100)throw Error('Invalid level');const s=getCard(id).baseStats;s.HP+=5*(level-1);return s;}
function spritePath(id){return path.join(__dirname,getCard(id).sprite);}
function validate(){if(byId.size!==cards.length)throw Error('Duplicate IDs');for(const c of cards){if(!types.includes(c.type)||!rarities.includes(c.rarity)||!fs.existsSync(spritePath(c.id)))throw Error('Invalid card '+c.id);if(c.mergeTarget){const target=getCard(c.mergeTarget);if(rarities.indexOf(target.rarity)!==rarities.indexOf(c.rarity)+1)throw Error('Invalid merge');}}return cards.length;}
module.exports={getCard,statsAt,spritePath,multiplier,validate,list:()=>structuredClone(cards)};
