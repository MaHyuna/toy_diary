export type PriceMenu = {columns:string[];sections:{title:string;breeds:string;note:string;rows:{weight:string;prices:string[]}[];items:{label:string;value:string}[];content:string}[]};
export function validatePriceMenu(value:unknown):PriceMenu {
 const fail=():never=>{throw new Error('모바일 요금표 형식을 확인해 주세요.');};
 const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:fail();
 const str=(v:unknown)=>typeof v==='string'&&v.length<=2000?v:fail();
 const arr=(v:unknown,n:number):unknown[]=>Array.isArray(v)&&v.length<=n?v:fail();
 const p=obj(value),columns=arr(p.columns,8).map(str);
 const sections=arr(p.sections,24).map(v=>{const s=obj(v);return {title:str(s.title),breeds:str(s.breeds),note:str(s.note),content:str(s.content),rows:arr(s.rows,30).map(v=>{const r=obj(v),prices=arr(r.prices,8).map(str);if(prices.length!==columns.length)fail();return {weight:str(r.weight),prices};}),items:arr(s.items,40).map(v=>{const i=obj(v);return {label:str(i.label),value:str(i.value)};})};});
 return {columns,sections};
}

const normalized=(menu:PriceMenu)=>({columns:menu.columns,sections:menu.sections.map(s=>({title:s.title,breeds:s.breeds,note:s.note,content:s.content,rows:s.rows.map(r=>({weight:r.weight,prices:r.prices})),items:s.items.map(i=>({label:i.label,value:i.value}))}))});
export const sameMenu=(a:PriceMenu|undefined,b:PriceMenu)=>!!a&&JSON.stringify(normalized(a))===JSON.stringify(normalized(b));
