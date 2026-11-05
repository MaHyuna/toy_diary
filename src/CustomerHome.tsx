import { GuardianNotebook } from './GuardianNotebook';
import { ArrowUpRight, CalendarDays, PawPrint, Scissors, Scale, Camera, Heart } from 'lucide-react';
import { appUrl } from './routes';
import { isDemo } from './runtime';
import { ShopNoticeBoard } from './ShopNotices';
import { CustomerCare } from './CustomerCare';
import './customer-home.css';

export function CustomerHome() {
  if (new URLSearchParams(window.location.search).has('token')) return <CustomerCare />;
  return <div className="customer-home notebook-home">
    <header className="customer-home-header"><a href={appUrl('home')}><PawPrint size={23}/><strong>몽글 · 미용수첩</strong></a><a href={appUrl('booking')}>예약하기 <ArrowUpRight size={16}/></a></header>
    {isDemo&&<p className="customer-home-demo">체험 수첩 · 공개 기록은 현재 브라우저에서 확인할 수 있어요.</p>}
    <main>
      <GuardianNotebook />
      <ShopNoticeBoard />
      <section className="notebook-features" aria-label="미용수첩에 남는 내용"><h2>수첩에는 이런 기록이 쌓여요</h2><div><Scale/><span><strong>방문별 몸무게</strong><small>방문 당시 체중과 지난 기록 비교</small></span></div><div><Camera/><span><strong>미용 전·후 사진</strong><small>받은 미용과 스타일 변화</small></span></div><div><Heart/><span><strong>미용 소견과 집에서 할 관리</strong><small>피부·털 상태, 보호자가 챙길 사항</small></span></div></section>
      <nav className="customer-shortcuts" aria-label="고객 메뉴"><a href={appUrl('booking')}><CalendarDays/><span>다음 미용 예약</span></a><a href={appUrl('prices')}><Scissors/><span>요금표</span></a></nav>
    </main><footer className="customer-home-footer"><PawPrint size={18}/><span>몽글 · 우리 아이 미용수첩</span></footer>
    <nav className="customer-home-bottom" aria-label="고객 하단 메뉴"><a href={appUrl('home')} aria-current="page">미용수첩</a><a href="#care-record">내 기록</a><a href={appUrl('booking')}>예약</a><a href={appUrl('prices')}>요금표</a></nav>
  </div>;
}
