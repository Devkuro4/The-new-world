import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
const run = promisify(execFile);
export const reactions: Record<string, { tag: string; verb: string; target?: boolean }> = {
 hug:{tag:'hug',verb:'hugged',target:true}, kiss:{tag:'kiss',verb:'kissed',target:true}, slap:{tag:'slap',verb:'slapped',target:true}, pat:{tag:'pat',verb:'patted',target:true}, poke:{tag:'poke',verb:'poked',target:true}, cuddle:{tag:'cuddle',verb:'cuddled',target:true}, bite:{tag:'bite',verb:'playfully bit',target:true}, highfive:{tag:'highfive',verb:'high-fived',target:true}, wave:{tag:'wave',verb:'waved at',target:true}, lick:{tag:'lick',verb:'playfully licked',target:true}, punch:{tag:'punch',verb:'punched',target:true}, bonk:{tag:'bonk',verb:'bonked',target:true}, tickle:{tag:'tickle',verb:'tickled',target:true}, dance:{tag:'dance',verb:'is dancing'}, sad:{tag:'cry',verb:'is sad'}, cry:{tag:'cry',verb:'is crying'}, smile:{tag:'smile',verb:'is smiling'}, laugh:{tag:'laugh',verb:'is laughing'}, blush:{tag:'blush',verb:'is blushing'}, shrug:{tag:'shrug',verb:'shrugged'},
};
export function mentionsName(text:string,name:string):boolean {
 return [name,'Pieck'].filter(Boolean).some(n=>new RegExp(`(?:^|[^\\p{L}\\p{N}_])${n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=$|[^\\p{L}\\p{N}_])`,'iu').test(text));
}
export function mentionLabel(jid:string):string { return '@'+jid.split('@')[0].split(':')[0]; }
const cacheRoot = join(process.env.DATA_DIR || './data', 'reaction-cache');
const allowedTags = new Set(Object.values(reactions).map(r => r.tag));
async function cached(tag:string):Promise<Buffer|undefined> {
 try { const dir=join(cacheRoot,tag); const files=(await readdir(dir)).filter(f=>f.endsWith('.mp4')); if(files.length) return await readFile(join(dir,files[Math.floor(Math.random()*files.length)])); } catch {} 
}
async function saveCache(tag:string,video:Buffer) {
 try { const dir=join(cacheRoot,tag); await mkdir(dir,{recursive:true}); const files=(await readdir(dir)).filter(f=>f.endsWith('.mp4')); if(files.length>=6) return; await writeFile(join(dir,randomUUID()+'.mp4'),video,{flag:'wx'}); } catch(e) { console.warn('[reaction cache]',e); }
}
export async function reactionVideo(tag:string):Promise<Buffer> {
 if(!allowedTags.has(tag)) throw Error('Unknown reaction');
 const previous=await cached(tag); if(previous && Math.random()<0.65) return previous;
 const providers = [`https://nekos.best/api/v2/${tag}`,`https://api.waifu.pics/sfw/${tag}`];
 for(const endpoint of [...providers,...providers]) {
  let dir:string|undefined;
  try {
   const response=await fetch(endpoint,{signal:AbortSignal.timeout(5000)}); if(!response.ok) throw Error(`Provider HTTP ${response.status}`);
   const data=await response.json() as {url?:string;results?:{url?:string}[]};
   const url=new URL(data.results?.[0]?.url || data.url || '');
   if(url.protocol!=='https:' || !['nekos.best','i.waifu.pics'].includes(url.hostname)) throw Error('Unexpected media host');
   const media=await fetch(url,{signal:AbortSignal.timeout(8000),redirect:'error'}); if(!media.ok || !media.body) throw Error(`Media HTTP ${media.status}`);
   const reader=media.body.getReader(); const chunks:Uint8Array[]=[]; let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12*1024*1024){await reader.cancel();throw Error('GIF too large');}chunks.push(value);}
   const bytes=Buffer.concat(chunks); if(!['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString())) throw Error('Media is not a GIF');
   dir=await mkdtemp(join(tmpdir(),'pieck-gif-')); const input=join(dir,'in.gif'), output=join(dir,'out.mp4'); await writeFile(input,bytes);
   await run(process.env.FFMPEG_PATH || (existsSync('./bin/ffmpeg') ? './bin/ffmpeg' : 'ffmpeg'),['-nostdin','-v','error','-i',input,'-t','12','-vf','scale=480:480:force_original_aspect_ratio=decrease:force_divisible_by=2','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',output],{timeout:20000});
   const video=await readFile(output); await saveCache(tag,video); return video;
  } catch(e) { console.warn(`[reaction ${tag}] ${endpoint}:`,e instanceof Error ? e.message : String(e)); } finally {if(dir) await rm(dir,{recursive:true,force:true}).catch(()=>{});}
 }
 if(previous) return previous;
 try { return await readFile(new URL(`../assets/reactions/${tag}.mp4`,import.meta.url)); } catch {}
 throw Error('Anime GIF unavailable');
}
