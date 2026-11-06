import type { PriceMenu } from './price-menu';
export type PriceRevision={version:number;savedAt:string;kind:'baseline'|'save'|'restore';restoredFrom:number|null;note:string;menu:PriceMenu};
export type PriceHistoryPage={entries:Omit<PriceRevision,'menu'>[];total:number;currentVersion:number};
export type PriceMenuState={version:number;menu:PriceMenu|null};
export const revisionLabel=(r:Pick<PriceRevision,'kind'|'restoredFrom'>)=>r.kind==='baseline'?'기존 저장본 보존':r.kind==='restore'?`v${r.restoredFrom}에서 복원`:'요금표 저장';
/** Preserve labels and ordering in comparisons; never interpret text prices as numbers. */
export function priceChanges(before:PriceMenu|null,after:PriceMenu){
 const flatten=(m:PriceMenu|null)=>{const values=new Map<string,{label:string;value:string}>();if(!m)return values;
  m.columns.forEach((v,i)=>values.set(`c${i}`,{label:`서비스 ${i+1}`,value:v}));
  m.sections.forEach((s,i)=>{for(const [key,label] of [['title','분류명'],['breeds','견종'],['note','안내'],['content','설명']] as const)values.set(`s${i}.${key}`,{label:`${s.title} · ${label}`,value:s[key]});
   s.rows.forEach((r,j)=>{values.set(`s${i}.r${j}`,{label:`${s.title} · 체중 ${j+1}`,value:r.weight});r.prices.forEach((v,k)=>values.set(`s${i}.r${j}.p${k}`,{label:`${s.title} · ${r.weight} · ${m.columns[k]}`,value:v}));});
   s.items.forEach((v,j)=>{values.set(`s${i}.i${j}.label`,{label:`${s.title} · 항목 ${j+1}`,value:v.label});values.set(`s${i}.i${j}.value`,{label:`${s.title} · ${v.label}`,value:v.value});});});return values;};
 const a=flatten(before),b=flatten(after);
 return [...new Set([...a.keys(),...b.keys()])].filter(k=>a.get(k)?.value!==b.get(k)?.value).map(k=>({key:k,label:b.get(k)?.label??a.get(k)!.label,before:a.get(k)?.value??'없음',after:b.get(k)?.value??'없음'}));
}
