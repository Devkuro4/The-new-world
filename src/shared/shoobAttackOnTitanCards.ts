import type { AnimeCard } from './botSchema';

const image = (id: string) => `https://api.shoob.gg/site/api/cardr/${id}?size=400`;
const source = (id: string) => `https://shoob.gg/cards/info/${id}`;

export const ATTACK_ON_TITAN_SHOOB_CARDS: AnimeCard[] = [
  { id: 'AOT-1-8777', name: 'Mikasa Ackerman', series: 'Attack on Titan', tier: 'C', sourceTier: 1, atk: 58, def: 64, stardustValue: 110, price: 850, imageUrl: image('688c0380ecef460072e28777'), sourceUrl: source('688c0380ecef460072e28777') },
  { id: 'AOT-1-B28F', name: 'Sasha Blouse', series: 'Attack on Titan', tier: 'C', sourceTier: 1, atk: 61, def: 55, stardustValue: 105, price: 800, imageUrl: image('65696850a7f891630355b28f'), sourceUrl: source('65696850a7f891630355b28f') },
  { id: 'AOT-1-B0D9', name: 'Mikasa Ackerman', series: 'Attack on Titan', tier: 'C', sourceTier: 1, atk: 63, def: 62, stardustValue: 120, price: 950, imageUrl: image('65696850a7f891630355b0d9'), sourceUrl: source('65696850a7f891630355b0d9') },
  { id: 'AOT-1-1D81', name: 'Kenny Ackerman', series: 'Attack on Titan', tier: 'C', sourceTier: 1, atk: 64, def: 51, stardustValue: 115, price: 900, imageUrl: image('606545417aebb6d450e21d81'), sourceUrl: source('606545417aebb6d450e21d81') },
  { id: 'AOT-1-1B6B', name: 'Beane', series: 'Attack on Titan', tier: 'C', sourceTier: 1, atk: 55, def: 60, stardustValue: 95, price: 700, imageUrl: image('606545407aebb6d450e21b6b'), sourceUrl: source('606545407aebb6d450e21b6b') },
  { id: 'AOT-1-1B55', name: 'Sawney', series: 'Attack on Titan', tier: 'C', sourceTier: 1, atk: 59, def: 58, stardustValue: 100, price: 750, imageUrl: image('606545407aebb6d450e21b55'), sourceUrl: source('606545407aebb6d450e21b55') },
  { id: 'AOT-1-2638', name: 'Hange Zoe', series: 'Attack on Titan', tier: 'C', sourceTier: 1, atk: 57, def: 63, stardustValue: 125, price: 1000, imageUrl: image('600468778c84a63ded182638'), sourceUrl: source('600468778c84a63ded182638') },
  { id: 'AOT-1-4459', name: 'Jean Kirstein', series: 'Attack on Titan', tier: 'C', sourceTier: 1, atk: 62, def: 59, stardustValue: 118, price: 925, imageUrl: image('60178ad0663aa03a2e444459'), sourceUrl: source('60178ad0663aa03a2e444459') },

  { id: 'AOT-2-CBE6', name: 'Levi Ackerman', series: 'Attack on Titan', tier: 'B', sourceTier: 2, atk: 76, def: 73, stardustValue: 260, price: 2200, imageUrl: image('69a38180068f310078d1cbe6'), sourceUrl: source('69a38180068f310078d1cbe6') },
  { id: 'AOT-2-949E', name: 'Mikasa Ackerman', series: 'Attack on Titan', tier: 'B', sourceTier: 2, atk: 74, def: 75, stardustValue: 270, price: 2300, imageUrl: image('683b98002fbf060012d3949e'), sourceUrl: source('683b98002fbf060012d3949e') },
  { id: 'AOT-2-6169', name: 'Eren Yeager', series: 'Attack on Titan', tier: 'B', sourceTier: 2, atk: 75, def: 70, stardustValue: 255, price: 2150, imageUrl: image('67eb2c802dbcec0012c46169'), sourceUrl: source('67eb2c802dbcec0012c46169') },
  { id: 'AOT-2-4B9E', name: 'Jean Kirstein', series: 'Attack on Titan', tier: 'B', sourceTier: 2, atk: 69, def: 72, stardustValue: 235, price: 1950, imageUrl: image('649fa4c0f170f3e6a71d4b9e'), sourceUrl: source('649fa4c0f170f3e6a71d4b9e') },
  { id: 'AOT-2-4B9B', name: 'Erwin Smith', series: 'Attack on Titan', tier: 'B', sourceTier: 2, atk: 71, def: 76, stardustValue: 280, price: 2400, imageUrl: image('649fa4c0f170f3e6a71d4b9b'), sourceUrl: source('649fa4c0f170f3e6a71d4b9b') },
  { id: 'AOT-2-C421', name: 'Eren Yeager', series: 'Attack on Titan', tier: 'B', sourceTier: 2, atk: 77, def: 68, stardustValue: 250, price: 2100, imageUrl: image('644f394005890e52fd36c421'), sourceUrl: source('644f394005890e52fd36c421') },
  { id: 'AOT-2-AC58', name: 'Yelena', series: 'Attack on Titan', tier: 'B', sourceTier: 2, atk: 68, def: 74, stardustValue: 230, price: 1900, imageUrl: image('603c74d0f482137fc732ac58'), sourceUrl: source('603c74d0f482137fc732ac58') },
  { id: 'AOT-2-4DB7', name: 'Sasha Blouse', series: 'Attack on Titan', tier: 'B', sourceTier: 2, atk: 72, def: 69, stardustValue: 240, price: 2000, imageUrl: image('60178ad1663aa03a2e444db7'), sourceUrl: source('60178ad1663aa03a2e444db7') },

  { id: 'AOT-3-A5C4', name: 'Levi Ackerman', series: 'Attack on Titan', tier: 'A', sourceTier: 3, atk: 88, def: 85, stardustValue: 480, price: 4100, imageUrl: image('68632500cb092100129da5c4'), sourceUrl: source('68632500cb092100129da5c4') },
  { id: 'AOT-3-A5BE', name: 'Annie, Mikasa & Historia', series: 'Attack on Titan', tier: 'A', sourceTier: 3, atk: 86, def: 88, stardustValue: 500, price: 4300, imageUrl: image('68632500cb092100129da5be'), sourceUrl: source('68632500cb092100129da5be') },
  { id: 'AOT-3-A5BB', name: 'Erwin Smith', series: 'Attack on Titan', tier: 'A', sourceTier: 3, atk: 84, def: 90, stardustValue: 510, price: 4400, imageUrl: image('68632500cb092100129da5bb'), sourceUrl: source('68632500cb092100129da5bb') },
  { id: 'AOT-3-A5B5', name: 'Mikasa Ackerman', series: 'Attack on Titan', tier: 'A', sourceTier: 3, atk: 89, def: 87, stardustValue: 520, price: 4500, imageUrl: image('68632500cb092100129da5b5'), sourceUrl: source('68632500cb092100129da5b5') },
  { id: 'AOT-3-1489', name: 'Yelena', series: 'Attack on Titan', tier: 'A', sourceTier: 3, atk: 82, def: 86, stardustValue: 450, price: 3800, imageUrl: image('66ab0840f244ebe9a8ac1489'), sourceUrl: source('66ab0840f244ebe9a8ac1489') },
  { id: 'AOT-3-13F6', name: 'Pieck Finger', series: 'Attack on Titan', tier: 'A', sourceTier: 3, atk: 85, def: 91, stardustValue: 530, price: 4600, imageUrl: image('66ab0840f244ebe9a8ac13f6'), sourceUrl: source('66ab0840f244ebe9a8ac13f6') },
  { id: 'AOT-3-353C', name: 'Erwin Smith', series: 'Attack on Titan', tier: 'A', sourceTier: 3, atk: 87, def: 89, stardustValue: 515, price: 4450, imageUrl: image('659246d0f244ebe9a8b7353c'), sourceUrl: source('659246d0f244ebe9a8b7353c') },
];
