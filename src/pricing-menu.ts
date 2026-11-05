import type { Pricing } from './types';
import type { PriceMenu } from './price-menu';
/** Same first-match rules as public booking. No independent customer-facing prices. */
export function pricingMenu(pricing:Pricing):PriceMenu {
 const edges=[...new Set([0,...pricing.weightRules.flatMap(r=>[r.minWeight,r.maxWeight]),150])].filter(n=>n>=0&&n<=150).sort((a,b)=>a-b);
 const groups=[{breed:'',amount:0},...pricing.breedRules];
 return {columns:pricing.services.map(s=>s.name),sections:groups.map(group=>({title:group.breed?`${group.breed} 미용`:'기본 미용',breeds:group.breed||'견종별 추가요금이 없는 아이',note:'입질·엉킴 등 현장 추가 작업은 상담 후 안내합니다.',content:'',items:[],rows:edges.slice(0,-1).map((min,i)=>{
  const max=edges[i+1],fee=pricing.weightRules.find(r=>min>=r.minWeight&&min<r.maxWeight)?.amount??0;
  return {weight:min===0?`${max}kg 미만`:max===150?`${min}~150kg 이하`:`${min}~${max}kg 미만`,prices:pricing.services.map(s=>String(s.basePrice+group.amount+fee))};
 })}))};
}
const normalized=(menu:PriceMenu)=>({columns:menu.columns,sections:menu.sections.map(s=>({title:s.title,breeds:s.breeds,note:s.note,content:s.content,rows:s.rows.map(r=>({weight:r.weight,prices:r.prices})),items:s.items.map(i=>({label:i.label,value:i.value}))}))});
export const sameMenu=(a:PriceMenu|undefined,b:PriceMenu)=>!!a&&JSON.stringify(normalized(a))===JSON.stringify(normalized(b));
