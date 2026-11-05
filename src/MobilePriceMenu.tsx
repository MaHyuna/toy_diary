import { useId, useState } from 'react';
import type { PriceMenu } from './price-menu';
const price=(value:string)=>/^\d+$/.test(value)?Number(value).toLocaleString('ko-KR'):value;
export function MobilePriceMenu({menu}:{menu:PriceMenu}) {
 const [selected,setSelected]=useState(0),id=useId();
 const section=menu.sections[selected];if(!section)return null;
 return <div className="mobile-price-menu"><nav className="price-category-tabs" aria-label="견종 및 요금 분류">{menu.sections.map((s,i)=><button key={i} aria-pressed={selected===i} aria-controls={id} onClick={()=>setSelected(i)}>{s.title}</button>)}</nav><section id={id} className="mobile-price-section" aria-label={section.title}>
 <header className="mobile-price-heading"><span className="price-flower" aria-hidden="true">✿</span><h2>{section.title}</h2></header>
 {section.breeds&&<p className="mobile-price-breeds">{section.breeds}</p>}{section.note&&<p className="mobile-price-note">{section.note}</p>}
 {section.rows.length>0&&<><p className="price-table-hint">단위: 원 <span>좌우로 밀어 전체 요금 확인 →</span></p><div className="mobile-price-table-scroll" tabIndex={0} role="region" aria-label={`${section.title} 몸무게별 요금표`}><table className="mobile-price-table"><thead><tr><th scope="col">몸무게</th>{menu.columns.map((name,i)=><th scope="col" key={i}>{name}</th>)}</tr></thead><tbody>{section.rows.map((row,i)=><tr key={i}><th scope="row">{row.weight}</th>{menu.columns.map((_,j)=><td key={j}>{price(row.prices[j]??'상담')}</td>)}</tr>)}</tbody></table></div></>}
 {section.items.length>0&&<dl className="mobile-price-services">{section.items.map((item,i)=><div key={i}><dt>{item.label}</dt><dd>{price(item.value)}</dd></div>)}</dl>}{section.content&&<p className="price-section-content">{section.content}</p>}
 </section></div>;
}
