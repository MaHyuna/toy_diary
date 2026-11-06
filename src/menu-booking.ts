import type { PriceMenu } from './price-menu';
export type MenuSource = {id:string;group:string;service:string;band:string};
export type BookingRule = {source:MenuSource;minWeight:number;maxWeight:number;duration:number};
export type MenuOffer = BookingRule & {id:string;name:string;group:string;service:string;band:string;price:number};
export type BookingCatalog = {revision:string;offers:MenuOffer[];unavailableCount:number};
export function menuSources(menu:PriceMenu|null): (MenuSource & {value:string})[] {
 return menu?.sections.flatMap((s,si)=>[
  ...s.rows.flatMap((r,ri)=>menu.columns.map((c,ci)=>({id:`cell:${si}:${ri}:${ci}`,group:s.title,service:c,band:r.weight,value:r.prices[ci]}))),
  ...s.items.map((item,ii)=>({id:`item:${si}:${ii}`,group:s.title,service:item.label,band:'',value:item.value}))
 ])??[];
}
export const sourceIdentity=({id,group,service,band}:MenuSource):MenuSource=>({id,group,service,band});
export function fixedMenuPrice(value:string):number|null {
 const v=value.trim();if(!/^(?:0|[1-9][0-9]*|[1-9][0-9]{0,2}(?:,[0-9]{3})+)(?:원)?$/.test(v))return null;
 const n=Number(v.replace(/원$/, '').replaceAll(',',''));return n<=100_000_000?n:null;
}
export const matchesSource=(a:MenuSource,b:MenuSource)=>a.id===b.id&&a.group===b.group&&a.service===b.service&&a.band===b.band;
export const matchesWeight=(r:BookingRule,w:number)=>Number.isFinite(w)&&w>0&&(r.minWeight<=w&&w<r.maxWeight||w===r.maxWeight&&w===150);
export function validateBookingRules(input:unknown,menu:PriceMenu|null):BookingRule[]{
 const fail=():never=>{throw Error('표 항목, 체중 범위와 소요 시간을 확인해 주세요.');};
 if(!input||typeof input!=='object'||Array.isArray(input))return fail();
 const data=input as {rules:BookingRule[]};if(Object.keys(data).join()!=='rules'||!Array.isArray(data.rules)||data.rules.length>300)return fail();
 const sources=menuSources(menu);const result:BookingRule[]=[];
 for(const r of data.rules){
  if(!r||Object.keys(r).sort().join()!=='duration,maxWeight,minWeight,source'||!r.source||Object.keys(r.source).sort().join()!=='band,group,id,service')return fail();
  const s=sources.find(s=>matchesSource(s,r.source));
  if(!s||fixedMenuPrice(s.value)===null||`${s.group} · ${s.service}`.length>80||![r.minWeight,r.maxWeight].every(v=>typeof v==='number'&&Number.isFinite(v))||r.minWeight<0||r.minWeight>=r.maxWeight||r.maxWeight>150||!Number.isInteger(r.duration)||r.duration<10||r.duration>480)return fail();
  if(result.some(p=>p.source.id===r.source.id||p.source.group===s.group&&p.source.service===s.service&&r.minWeight<p.maxWeight&&p.minWeight<r.maxWeight))return fail();
  result.push({source:sourceIdentity(s),minWeight:r.minWeight,maxWeight:r.maxWeight,duration:r.duration});
 }
 return result;
}
export async function buildBookingCatalog(menu:PriceMenu|null,rules:BookingRule[]):Promise<BookingCatalog>{
 const sources=menuSources(menu),offers:MenuOffer[]=[];
 for(const r of rules){const s=sources.find(s=>matchesSource(s,r.source));if(!s)continue;const price=fixedMenuPrice(s.value);if(price===null)continue;offers.push({...r,...sourceIdentity(s),name:`${s.group} · ${s.service}`,price});}
 const bytes=new TextEncoder().encode(JSON.stringify([menu,rules]));
 const revision=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 return {revision,offers,unavailableCount:rules.length-offers.length};
}
