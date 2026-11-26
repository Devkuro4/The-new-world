const {randomUUID,randomInt}=require('node:crypto');
const R=require('./registry.cjs'), P=require('./progression.cjs');
const ODDS=Object.freeze({universal:Object.freeze([4500,2700,1600,800,300,100]),super:Object.freeze([0,0,0,7500,2000,500])});
const RARITIES=['Common','Uncommon','Rare','Super Rare','SS Rare','Ultra Rare'];
const SHOP=Object.freeze({1:[{key:'universal',name:'Universal Card Pack',price:500}],2:[{key:'healthPotion',name:'Health Potion',price:100},{key:'purificationVial',name:'Purification Vial',price:120},{key:'xpBooster',name:'XP Booster',price:200},{key:'energyElixir',name:'Energy Elixir',price:100},{key:'antidote',name:'Antidote',price:80}]});
const ITEMS=new Set([...Object.values(SHOP).flat().map(x=>x.key),'super','trainingMaterials','ascensionCores']);
const integer=(n)=>Number.isSafeInteger(n)&&n>=0;
const own=(o,k)=>Object.hasOwn(o,k)?o[k]:undefined;
const put=(o,k,v)=>Object.defineProperty(o,k,{value:v,writable:true,enumerable:true,configurable:true});
function rollRarity(kind,roll){const odds=own(ODDS,kind);if(!odds||!integer(roll)||roll>=10000)throw Error('Invalid rarity roll');for(let i=0;i<odds.length;i++){if(roll<odds[i])return RARITIES[i];roll-=odds[i];}throw Error('Invalid odds');}
class Economy{
 constructor({state={},random=(n)=>randomInt(n),now=Date.now,prices={},bonusChance=2000}={}){if(!integer(bonusChance)||bonusChance>10000)throw Error('Invalid bonus chance');this.state=state;this.state.players??={};this.random=random;this.now=now;this.prices=prices;this.bonusChance=bonusChance;}
 roll(n){const r=this.random(n);if(!integer(r)||r>=n)throw Error('Invalid random value');return r;}
 player(id){if(typeof id!=='string'||!id)throw Error('Invalid player');return own(this.state.players,id)||{credits:0,items:{},cards:[],receipts:{},boostUntil:0};}
 transaction(id,fn){const p=structuredClone(this.player(id));const result=fn(p);put(this.state.players,id,p);return structuredClone(result);}
 info(id){return structuredClone(this.player(id));}
 collection(id){return this.info(id).cards;}
 shop(category){if(!own(SHOP,category))throw Error('Unknown shop category');return SHOP[category].map((x,i)=>{const price=own(this.prices,x.key)??x.price;if(!integer(price))throw Error('Invalid price');return {...x,index:i+1,price};});}
 add(p,key,n){if(!ITEMS.has(key)||!integer(n))throw Error('Invalid item');const next=(own(p.items,key)??0)+n;if(!integer(next))throw Error('Invalid item quantity');p.items[key]=next;}
 spend(p,key,n=1){if(!ITEMS.has(key)||!integer(n)||n===0||(own(p.items,key)??0)<n)throw Error('Insufficient inventory');p.items[key]-=n;}
 buy(id,category,index){const item=this.shop(category)[index-1];if(!Number.isInteger(index)||!item)throw Error('Unknown shop item');return this.transaction(id,p=>{if(p.credits<item.price)throw Error('Insufficient Credits');p.credits-=item.price;this.add(p,item.key,1);return {...item,balance:p.credits};});}
 grant(id,receipt,{credits=0,items={},cards=[],xp=[]}={}){if(typeof receipt!=='string'||!receipt||!integer(credits))throw Error('Invalid reward');return this.transaction(id,p=>{if(own(p.receipts,receipt))return {duplicate:true};if(!integer(p.credits+credits))throw Error('Credit overflow');p.credits+=credits;for(const [k,n] of Object.entries(items))this.add(p,k,n);for(const card of cards){if(card.id.startsWith('catalog:'))R.getCollectible(card.id);else R.getCard(card.id);const uid=card.uid??randomUUID();if(typeof uid!=='string'||!uid||p.cards.some(c=>c.uid===uid))throw Error('Duplicate card instance');p.cards.push(P.gainXP({...card,uid,xp:card.xp??0},0));}for(const reward of xp){const i=p.cards.findIndex(c=>c.uid===reward.id);if(i<0)throw Error('Unknown XP recipient');p.cards[i]=P.gainXP(p.cards[i],reward.xp);}put(p.receipts,receipt,true);return {duplicate:false};});}
 open(id,kind){if(!own(ODDS,kind))throw Error('Unknown pack');return this.transaction(id,p=>{this.spend(p,kind);const count=4+(this.roll(10000)<this.bonusChance?1:0),roster=R.collectibleList(),cards=[];for(let i=0;i<count;i++){const rolled=rollRarity(kind,this.roll(10000));let rarity=rolled;while(!roster.some(c=>c.rarity===rarity)&&RARITIES.indexOf(rarity)>0)rarity=RARITIES[RARITIES.indexOf(rarity)-1];if(!roster.some(c=>c.rarity===rarity))rarity=RARITIES.find(r=>roster.some(c=>c.rarity===r))||'Common';const pool=roster.filter(c=>c.rarity===rarity);if(!pool.length)throw Error('No cards for rarity '+rarity);const c=pool[this.roll(pool.length)],level=1+this.roll(10),card={id:c.id,uid:randomUUID(),level,xp:0};p.cards.push(card);cards.push({...card,name:c.name,rarity});}return {kind,cards,bonus:count===5};});}
 activateBooster(id){return this.transaction(id,p=>{if(p.boostUntil>this.now())throw Error('XP Booster already active');this.spend(p,'xpBooster');p.boostUntil=this.now()+600000;return {expires:p.boostUntil};});}
 xpMultiplier(id){return this.player(id).boostUntil>this.now()?2:1;}
 snapshot(){return structuredClone(this.state);}
}
module.exports={Economy,ODDS,RARITIES,rollRarity,SHOP};
