import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
const run = promisify(execFile);
export const reactions: Record<string, { tag: string; verb: string; target?: boolean }> = {
 hug:{tag:'hug',verb:'hugged',target:true}, kiss:{tag:'kiss',verb:'kissed',target:true}, slap:{tag:'slap',verb:'slapped',target:true}, pat:{tag:'pat',verb:'patted',target:true}, poke:{tag:'poke',verb:'poked',target:true}, cuddle:{tag:'cuddle',verb:'cuddled',target:true}, bite:{tag:'bite',verb:'playfully bit',target:true}, highfive:{tag:'highfive',verb:'high-fived',target:true}, wave:{tag:'wave',verb:'waved at',target:true}, lick:{tag:'lick',verb:'playfully licked',target:true}, punch:{tag:'punch',verb:'punched',target:true}, bonk:{tag:'bonk',verb:'bonked',target:true}, tickle:{tag:'tickle',verb:'tickled',target:true}, dance:{tag:'dance',verb:'is dancing'}, sad:{tag:'cry',verb:'is sad'}, cry:{tag:'cry',verb:'is crying'}, smile:{tag:'smile',verb:'is smiling'}, laugh:{tag:'laugh',verb:'is laughing'}, blush:{tag:'blush',verb:'is blushing'}, shrug:{tag:'shrug',verb:'shrugged'},
};
export function mentionsName(text:string,name:string):boolean {
 return [name,'Pieck'].filter(Boolean).some(n=>new RegExp(`(?:^|[^\\p{L}\\p{N}_])${n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=$|[^\\p{L}\\p{N}_])`,'iu').test(text));
}
export function mentionLabel(jid:string):string { return '@'+jid.split('@')[0].split(':')[0]; }
export async function reactionVideo(tag:string):Promise<Buffer> {
 const providers = [`https://nekos.best/api/v2/${tag}`,`https://api.waifu.pics/sfw/${tag}`];
 for(const endpoint of providers) {
  let dir:string|undefined;
  try {
   const response=await fetch(endpoint,{signal:AbortSignal.timeout(5000)}); if(!response.ok) continue;
   const data=await response.json() as {url?:string;results?:{url?:string}[]};
   const url=new URL(data.results?.[0]?.url || data.url || '');
   if(url.protocol!=='https:' || !['nekos.best','i.waifu.pics'].includes(url.hostname)) continue;
   const media=await fetch(url,{signal:AbortSignal.timeout(8000),redirect:'error'}); if(!media.ok || !media.body) continue;
   const reader=media.body.getReader(); const chunks:Uint8Array[]=[]; let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12*1024*1024){await reader.cancel();throw Error('GIF too large');}chunks.push(value);}
   const bytes=Buffer.concat(chunks); if(!['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString())) continue;
   dir=await mkdtemp(join(tmpdir(),'pieck-gif-')); const input=join(dir,'in.gif'), output=join(dir,'out.mp4'); await writeFile(input,bytes);
   await run(process.env.FFMPEG_PATH || (existsSync('./bin/ffmpeg') ? './bin/ffmpeg' : 'ffmpeg'),['-nostdin','-v','error','-i',input,'-t','12','-vf','scale=480:480:force_original_aspect_ratio=decrease:force_divisible_by=2','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',output],{timeout:20000});
   return await readFile(output);
  } catch { /* Try the next action-specific provider. */ } finally {if(dir) await rm(dir,{recursive:true,force:true}).catch(()=>{});}
 }
 throw Error('Anime GIF unavailable');
}
