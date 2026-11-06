import type { ReactNode } from 'react';
import type { PriceMenu } from './price-menu';
import './ui/price-menu-layout.css';
export type PriceCellAddress = {section:number;row:number;column:number} | {section:number;item:number};
type MenuProps={menu:PriceMenu;renderPrice?:(value:string,label:string,address:PriceCellAddress)=>ReactNode;sectionActions?:(index:number)=>ReactNode};
const price=(value:string)=>/^\d+$/.test(value)?Number(value).toLocaleString('ko-KR'):value;
/** The same printable matrix is used for customer reading and owner editing. */
export function MobilePriceMenu({menu,renderPrice,sectionActions}:MenuProps){
 return <div className="price-menu-sections">{menu.sections.map((section,si)=><div key={si} className="mobile-price-menu" data-layout={section.rows.length?'matrix':'list'}><section className="mobile-price-section" aria-label={section.title}>
  <div className="price-section-heading-row"><header className="mobile-price-heading"><span className="price-flower" aria-hidden="true">✿</span><h2>{section.title}</h2></header>{sectionActions?.(si)}</div>
  {section.breeds&&<p className="mobile-price-breeds">{section.breeds}</p>}{section.rows.length>0&&section.note&&<p className="mobile-price-note">{section.note}</p>}
  {section.rows.length>0&&<><p className="price-table-hint">단위: 원</p><table className="mobile-price-table"><caption className="sr-only">{section.title} · 서비스별 체중 요금</caption><thead><tr><th scope="col">몸무게</th>{menu.columns.map((name,ci)=><th key={ci} scope="col">{name}</th>)}</tr></thead><tbody>{section.rows.map((row,ri)=><tr key={ri}><th scope="row">{row.weight}</th>{menu.columns.map((name,ci)=><td key={ci}>{renderPrice?renderPrice(row.prices[ci],`${section.title} ${row.weight} ${name} 금액`,{section:si,row:ri,column:ci}):price(row.prices[ci])}</td>)}</tr>)}</tbody></table></>}
  {section.items.length>0&&<dl className="mobile-price-services">{section.items.map((item,ii)=><div key={ii}><dt>{item.label}</dt><dd>{renderPrice?renderPrice(item.value,`${section.title} ${item.label} 금액`,{section:si,item:ii}):price(item.value)}</dd></div>)}</dl>}
  {!section.rows.length&&section.note&&<p className="mobile-price-note">{section.note}</p>}
  {section.content&&<p className="price-section-content">{section.content}</p>}
 </section></div>)}</div>;
}
