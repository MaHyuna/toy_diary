import { useEffect, useState } from 'react';
import { PawPrint, Download, ArrowUpRight } from 'lucide-react';
import { api } from './types';
import { appUrl } from './routes';
import { isDemo } from './runtime';
import { MobilePriceMenu } from './MobilePriceMenu';
import { validatePriceMenu } from './price-menu';
import type { PriceMenu } from './price-menu';
import './price-poster.css';
type Poster={image:string;description:string;menu?:PriceMenu};
export function CustomerPrices(){
 const [original,setOriginal]=useState(false),[poster,setPoster]=useState<Poster|null>(null),[example,setExample]=useState<PriceMenu|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;api<Poster|null>('/public/price-poster').then(async data=>{if(!active)return;setPoster(data);if(!data&&isDemo){const response=await fetch('images/demo-price-menu.json');if(!response.ok)throw Error('요금표를 불러오지 못했어요.');const menu=validatePriceMenu(await response.json());if(active)setExample(menu);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 const menu=poster?.menu??example,image=poster?.image??(isDemo?'images/demo-price-menu.jpg':''),description=poster?.description;
 return <div className={`customer-price-page ${original?'show-original':''}`}><header><a href={appUrl('home')}><PawPrint size={21}/>미용수첩</a><a href={appUrl('booking')}>예약하기 <ArrowUpRight size={16}/></a></header><main><h1 className="price-page-title">미용 요금 안내</h1>{loading?<p role="status">요금표를 불러오고 있어요…</p>:error?<p role="alert">{error}</p>:image?<>{!poster&&<p className="poster-example">디자인 예시 · 실제 게시 요금이 아닙니다.</p>}<div className="price-view-actions"><button type="button" aria-pressed={original} onClick={()=>setOriginal(v=>!v)}>{original?'읽기 편하게 보기':'원본 디자인 보기'}</button><a href={image} download="미용요금표.jpg"><Download size={16}/>저장</a></div>{menu&&<MobilePriceMenu menu={menu}/>}<div className={`price-original ${menu?'has-mobile-menu':''}`}><div className="price-poster-scroll" tabIndex={0} aria-label="원본 미용 요금표"><img src={image} alt="매장의 견종·몸무게별 미용 요금표"/></div></div>{description&&<details className={`poster-text ${menu?'has-mobile-menu':''}`} open={!menu||undefined}><summary>요금표 글자로 보기</summary><pre>{description}</pre></details>}</>:<p>매장에서 요금표를 준비 중이에요.</p>}<p className="price-consult-note">견종·몸무게·털 상태와 원하는 스타일에 따라 상담 후 최종 금액을 안내합니다.</p></main></div>;
}
