const fs = require('node:fs');
const path = require('node:path');
const cards = require('./characters.json');
const artworkIds = require('./card-artwork-map.json');
const collectibleCards = require('./mazoku-cards.json');
const artworkById = new Map(collectibleCards.map(card => [card.card_id, card]));
const battleByArtworkId = new Map(Object.entries(artworkIds).map(([battleId, artworkId]) => [artworkId, battleId]));
const types = ['Strength','Agility','Arcane','Vitality'];
const rarities = ['Common','Uncommon','Rare','Epic','Legendary','Mythical','Celestial'];
const byId = new Map(cards.map(c => [c.id,c]));
const matchups = [[1,.5,1.5,.5],[1.5,1,.5,1.5],[.5,1.5,1,1.5],[1.5,.5,.5,1]];
function multiplier(a,b){if(!types.includes(a)||!types.includes(b))throw Error('Unknown type');return matchups[types.indexOf(a)][types.indexOf(b)];}
function getCard(id){const c=byId.get(id);if(!c)throw Error('Unknown card');return structuredClone(c);}
const collectibleId=cardId=>`catalog:${cardId}`;
const catalogRarity=rarity=>({C:'Common',R:'Uncommon',SR:'Rare',SSR:'Epic',UR:'Legendary'})[rarity];
function getCollectible(id){
  const raw=id.startsWith('catalog:')?id.slice(8):id;
  const card=artworkById.get(raw);
  if(!card)throw Error('Unknown collectible card');
  const battleId=battleByArtworkId.get(card.card_id);
  return {id:collectibleId(card.card_id),catalogId:card.card_id,name:card.character_name,series:card.series,
    rarity:catalogRarity(card.rarity),catalogRarity:card.rarity,imageUrl:card.image_url,pageUrl:card.card_url,
    battleId,battleReady:Boolean(battleId)};
}
function resolveBattleId(id){if(byId.has(id))return id;const c=getCollectible(id);if(!c.battleId)throw Error('Card is not battle-ready');return c.battleId;}
function isBattleReady(id){try{resolveBattleId(id);return true;}catch{return false;}}
function statsAt(id,level){if(!Number.isInteger(level)||level<1||level>100)throw Error('Invalid level');const s=getCard(resolveBattleId(id)).baseStats;s.HP+=5*(level-1);return s;}
function spritePath(id){return path.join(__dirname,getCard(resolveBattleId(id)).sprite);}
function cardArtwork(id){
  const raw=id.startsWith('catalog:')?id.slice(8):artworkIds[id];
  const card = artworkById.get(raw);
  return card ? { imageUrl: card.image_url, pageUrl: card.card_url } : undefined;
}
function validate(){if(byId.size!==cards.length||artworkById.size!==collectibleCards.length)throw Error('Duplicate IDs');for(const c of cards){if(!types.includes(c.type)||!rarities.includes(c.rarity)||!fs.existsSync(spritePath(c.id)))throw Error('Invalid card '+c.id);if(c.mergeTarget){const target=getCard(c.mergeTarget);if(rarities.indexOf(target.rarity)!==rarities.indexOf(c.rarity)+1)throw Error('Invalid merge');}}for(const c of collectibleCards){if(!catalogRarity(c.rarity)||!/^https:\/\/cdn7\.mazoku\.cc\/cards\//.test(c.image_url))throw Error('Invalid collectible '+c.card_id);}return cards.length;}
module.exports={getCard,getCollectible,statsAt,spritePath,cardArtwork,resolveBattleId,isBattleReady,multiplier,validate,
  list:()=>structuredClone(cards),collectibleList:()=>collectibleCards.map(c=>getCollectible(c.card_id))};
