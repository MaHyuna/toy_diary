import { useState } from 'react';
import type { PriceMenu } from './price-menu';
const price=(v:string)=>/^\d+$/.test(v)?Number(v).toLocaleString('ko-KR')+'원':v;
export function MobilePriceMenu({menu}:{menu:PriceMenu}) {
 const [selected,setSelected]=useState(0),[row,setRow]=useState(0);
 const section=menu.sections[selected];if(!section)return null;
 return <section className="mobile-price-menu" aria-label="휴대폰용 요금안내"><nav aria-label="견종 및 요금 분류">{menu.sections.map((s,i)=><button key={i} aria-pressed={selected===i} onClick={()=>{setSelected(i);setRow(0);}}>{s.title}</button>)}</nav><div className="mobile-price-section"><h2>{section.title}</h2>{section.breeds&&<p className="mobile-price-breeds">{section.breeds}</p>}{section.rows.length>0&&<><label className="mobile-weight-select">우리 아이 몸무게<select aria-label="우리 아이 몸무게" value={row} onChange={e=>setRow(Number(e.target.value))}>{section.rows.map((r,i)=><option key={i} value={i}>{r.weight}</option>)}</select></label><dl className="mobile-price-services">{menu.columns.map((name,i)=><div key={i}><dt>{name}</dt><dd>{price(section.rows[row]?.prices[i]??'상담')}</dd></div>)}</dl></>}{section.items.length>0&&<dl className="mobile-price-services">{section.items.map((item,i)=><div key={i}><dt>{item.label}</dt><dd>{price(item.value)}</dd></div>)}</dl>}{section.content&&<p>{section.content}</p>}{section.note&&<p className="mobile-price-note">{section.note}</p>}</div></section>;
}
