import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, Heart, PawPrint, Scissors } from 'lucide-react';
import { appUrl } from './routes';
import { api, money } from './types';
import type { Pricing } from './types';
import { isDemo } from './runtime';
import './customer-home.css';

export function CustomerHome() {
  const [catalog, setCatalog] = useState<{name:string;hours:string;pricing:Pricing}|null>(null);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { let active=true; setError(''); api<typeof catalog>('/public/catalog').then(value=>{if(active)setCatalog(value);}).catch(e=>{if(active)setError(e.message);}); return()=>{active=false;}; }, [retry]);
  function openRecord(event: React.FormEvent) {
    event.preventDefault();
    let token=link.trim();
    try { if (!/^[a-f0-9]{32}$/.test(token)) token=new URL(token).searchParams.get('token')??''; } catch { token=''; }
    if (!/^[a-f0-9]{32}$/.test(token)) {setLinkError('매장에서 받은 미용 기록 링크를 확인해 주세요.');return;}
    window.location.assign(appUrl('care',{token}));
  }
  return <div className="customer-home">
    <header className="customer-home-header"><a href={appUrl('home')}><PawPrint size={23}/><strong>{catalog?.name??'몽글 미용실'}</strong></a><a href={appUrl('booking')}>예약하기 <ArrowUpRight size={16}/></a></header>
    {isDemo&&<p className="customer-home-demo">예시 매장 체험 · 실제 예약이 접수되는 매장이 아닙니다.</p>}
    <main>
      <section className="customer-welcome"><div><span className="customer-kicker">작은 변화도, 다정하게</span><h1>우리 아이의<br/>미용하는 날.</h1><p>미용을 예약하고,<br/>달라진 모습과 관리 이야기를 만나보세요.</p><a className="customer-book-button" href={appUrl('booking')}>우리 아이 예약하기 <ArrowUpRight size={19}/></a></div><img src="./images/studio-art.webp" alt="따뜻한 분위기의 반려견 미용 일러스트"/></section>
      <nav className="customer-shortcuts" aria-label="고객 메뉴"><a href={appUrl('booking')}><CalendarDays/><span>미용 예약</span></a><a href={appUrl('prices')}><Scissors/><span>요금 안내</span></a><a href="#care-record"><Heart/><span>미용 기록</span></a></nav>
      <section className="customer-home-section"><div className="customer-section-title"><div><span className="customer-kicker">GROOMING MENU</span><h2>어떤 관리가 필요할까요?</h2></div><a href={appUrl('prices')}>전체 요금 <ArrowUpRight size={15}/></a></div>
        {error?<div role="alert"><p>{error}</p><button onClick={()=>setRetry(v=>v+1)}>다시 불러오기</button></div>:!catalog?<p role="status">매장 안내를 불러오고 있어요…</p>:<><div className="customer-service-preview">{catalog.pricing.services.slice(0,3).map(service=><a href={appUrl('prices')} key={service.id}><strong>{service.name}</strong><span>약 {service.duration}분</span><b>{money(service.basePrice)}원부터</b><ArrowUpRight size={17}/></a>)}</div><p className="customer-home-note">견종·몸무게·모질에 따라 금액이 달라질 수 있어요. 추가 작업은 상담 후 안내합니다.</p></>}
      </section>
      <section className="customer-care-entry customer-home-section" id="care-record"><span className="customer-kicker">AFTER GROOMING</span><h2>예뻐진 모습, 집에서도 이어지는 케어</h2><p>매장에서 보내드린 전용 링크로 미용 전후 사진과<br/>미용 소견, 집에서 챙길 사항을 확인하세요.</p><form onSubmit={openRecord}><label htmlFor="customer-care-link">받은 미용 기록 링크</label><div><input id="customer-care-link" type="text" inputMode="url" value={link} onChange={e=>{setLink(e.target.value);setLinkError('');}} placeholder="매장에서 받은 링크 붙여넣기" required autoComplete="off"/><button type="submit">기록 보기</button></div>{linkError&&<p role="alert">{linkError}</p>}</form><small>기록 링크가 없다면 매장에 공유를 요청해 주세요.</small></section>
      <section className="customer-home-section customer-visit-guide"><span className="customer-kicker">BEFORE YOUR VISIT</span><h2>방문 전, 함께 확인해요</h2><dl><div><dt>예약 안내</dt><dd>신청 후 매장에서 일정을 확인하면 예약이 확정됩니다. 변경·취소는 매장에 문의해 주세요.</dd></div><div><dt>예약 가능 시간</dt><dd>{catalog?.hours??'매장 안내를 불러오는 중'}</dd></div><div><dt>아이에게 필요한 배려</dt><dd>피부 상태, 알레르기와 예민한 부위를 예약할 때 알려 주세요.</dd></div></dl></section>
    </main><footer className="customer-home-footer"><PawPrint size={18}/><strong>{catalog?.name??'몽글 미용실'}</strong><span>우리 아이의 다정한 기록</span></footer>
    <nav className="customer-home-bottom" aria-label="고객 하단 메뉴"><a href={appUrl('home')} aria-current="page">홈</a><a href={appUrl('booking')}>예약</a><a href={appUrl('prices')}>요금표</a><a href="#care-record">미용 기록</a></nav>
  </div>;
}
