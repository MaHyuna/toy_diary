import { useState } from 'react';
import { ArrowUpRight, BookHeart, CalendarDays, PawPrint, Scissors, Scale, Camera, Heart } from 'lucide-react';
import { appUrl } from './routes';
import { isDemo } from './runtime';
import { ShopNoticeBoard } from './ShopNotices';
import { CustomerCare } from './CustomerCare';
import './customer-home.css';

export function CustomerHome() {
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  if (new URLSearchParams(window.location.search).has('token')) return <CustomerCare />;
  function openRecord(event: React.FormEvent) {
    event.preventDefault();
    let token=link.trim();
    try { if (!/^[a-f0-9]{32}$/.test(token)) token=new URL(token).searchParams.get('token')??''; } catch { token=''; }
    if (!/^[a-f0-9]{32}$/.test(token)) {setLinkError('매장에서 받은 미용 기록 링크를 확인해 주세요.');return;}
    window.location.assign(appUrl('home',{token}));
  }
  return <div className="customer-home notebook-home">
    <header className="customer-home-header"><a href={appUrl('home')}><PawPrint size={23}/><strong>몽글 · 미용수첩</strong></a><a href={appUrl('booking')}>예약하기 <ArrowUpRight size={16}/></a></header>
    {isDemo&&<p className="customer-home-demo">체험 수첩 · 공개 기록은 현재 브라우저에서 확인할 수 있어요.</p>}
    <main>
      <section className="notebook-intro"><span className="customer-kicker">우리 아이의 다정한 기록</span><h1>차곡차곡,<br/>우리 아이 미용수첩</h1><p>몸무게부터 미용 후 달라진 모습까지.<br/>매장에서 받은 관리를 함께 기억해요.</p><BookHeart size={76} strokeWidth={1} aria-hidden="true"/></section>
      <section className="notebook-open" id="care-record"><h2>우리 아이 수첩 열기</h2><p>매장에서 보내드린 기록 링크를 넣어 주세요.<br/>같은 아이의 공개된 방문 기록을 모아 볼 수 있어요.</p><form onSubmit={openRecord}><label htmlFor="customer-care-link">받은 미용 기록 링크</label><input id="customer-care-link" type="text" inputMode="url" value={link} onChange={e=>{setLink(e.target.value);setLinkError('');}} placeholder="기록 링크 붙여넣기" required autoComplete="off"/><button className="customer-book-button" type="submit">미용수첩 열기 <ArrowUpRight size={18}/></button>{linkError&&<p role="alert">{linkError}</p>}</form><small>첫 방문이거나 링크가 없다면 매장에 수첩 공유를 요청해 주세요.</small></section>
      <ShopNoticeBoard />
      <section className="notebook-features" aria-label="미용수첩에 남는 내용"><h2>수첩에는 이런 기록이 쌓여요</h2><div><Scale/><span><strong>방문별 몸무게</strong><small>방문 당시 체중과 지난 기록 비교</small></span></div><div><Camera/><span><strong>미용 전·후 사진</strong><small>받은 미용과 스타일 변화</small></span></div><div><Heart/><span><strong>미용 소견과 집에서 할 관리</strong><small>피부·털 상태, 보호자가 챙길 사항</small></span></div></section>
      <nav className="customer-shortcuts" aria-label="고객 메뉴"><a href={appUrl('booking')}><CalendarDays/><span>다음 미용 예약</span></a><a href={appUrl('prices')}><Scissors/><span>요금표</span></a></nav>
    </main><footer className="customer-home-footer"><PawPrint size={18}/><span>몽글 · 우리 아이 미용수첩</span></footer>
    <nav className="customer-home-bottom" aria-label="고객 하단 메뉴"><a href={appUrl('home')} aria-current="page">미용수첩</a><a href="#care-record">기록 열기</a><a href={appUrl('booking')}>예약</a><a href={appUrl('prices')}>요금표</a></nav>
  </div>;
}
