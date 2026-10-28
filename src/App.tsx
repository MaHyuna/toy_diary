import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowDownToLine, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, CreditCard, Dog, Leaf, Menu, PawPrint, Plus, ReceiptText, Search, Settings2, Sparkles, Tags, Trash2, UsersRound, FlaskConical, Wallet, X } from 'lucide-react';
import type { Appointment, State } from './types';
import { api, money, paymentLabels, today } from './types';
import { AppointmentForm, ConfirmDialog, ExpenseForm, Modal, SettleForm } from './Forms';
import { PricingPanel } from './Pricing';
import { AppointmentDetails } from './AppointmentDetails';
import { CustomersPanel, PetForm } from './Customers';
import { ShampoosPanel } from './Shampoos';
import { isDemo } from './runtime';
import { StudioCalendar } from './StudioCalendar';
import { shiftMonth } from './calendar';
import { MobileNavigation, QuickAddButton } from './MobileActions';

type View = 'overview' | 'appointments' | 'settlement' | 'ledger' | 'pricing' | 'customers' | 'supplies' | 'guide';
type Dialog = { type: 'more' | 'demoInfo' | 'newCustomer' | 'day' } | { type: 'demoReset' } | { type: 'details'; appointment: Appointment } | { type: 'appointment'; appointment?: Appointment; petId?: string } | { type: 'expense' } | { type: 'settle'; appointment: Appointment } | { type: 'cancel'; appointment: Appointment } | { type: 'deleteExpense'; id: string } | null;
const navigation = [
  { id: 'overview', label: '예약 캘린더', icon: CalendarDays },
  { id: 'appointments', label: '예약 일정', icon: CalendarDays },
  { id: 'customers', label: '고객 · 반려견 대장', icon: UsersRound },
  { id: 'settlement', label: '미용 장부', icon: CreditCard },
  { id: 'ledger', label: '운영비 · 손익', icon: ReceiptText },
  { id: 'pricing', label: '우리 가게 요금표', icon: Tags },
  { id: 'supplies', label: '샴푸 · 사용 원가', icon: FlaskConical },
] as const;
const titles: Record<View, { title: string; subtitle: string }> = {
  overview: { title: '예약 캘린더', subtitle: '예약을 잡고, 미용을 마치고, 한 번에 기록해요.' },
  appointments: { title: '예약 일정', subtitle: '아이들과 만나는 시간을 꼼꼼하게 챙겨요.' },
  settlement: { title: '미용 장부', subtitle: '아이별 미용 내역과 금액을 방문일 기준으로 모았어요.' },
  ledger: { title: '운영비 · 손익', subtitle: '매장 비용과 실제 받은 미용 대금을 확인해요.' },
  guide: { title: '몽글 사용 안내', subtitle: '하루의 기록이 쌓여 더 든든한 가게가 되도록.' },
  customers: { title: '고객 · 반려견 관리대장', subtitle: '아이의 특성과 지난 방문을 기억하는, 우리 가게의 고객 기록.' },
  supplies: { title: '샴푸 · 사용 원가', subtitle: '사용하는 제품부터 한 번의 미용에 드는 비용까지.' },
  pricing: { title: '우리 가게 요금표', subtitle: '기본 미용부터 견종 · 몸무게까지, 우리 가게에 맞는 기준으로.' },
};
const empty: State = { appointments: [], expenses: [], customers: [], pets: [], shampoos: [], pricing: { services: [], breedRules: [], weightRules: [] }, summary: { revenue: 0, totalExpenses: 0, profit: 0, unpaidAmount: 0, paidCount: 0, shampooCost: 0 } };
const formatDate = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${value}T12:00:00+09:00`));
const shortDate = (value: string) => `${Number(value.slice(5, 7))}.${Number(value.slice(8))}`;
function Empty({ title, detail, onAdd, label = '첫 예약 등록하기' }: { title: string; detail: string; onAdd?: () => void; label?: string }) {
  return <div className="empty-state"><div className="empty-illustration"><Dog size={42} strokeWidth={1.3} /><span><Sparkles size={17} /></span></div><h3>{title}</h3><p>{detail}</p>{onAdd && <button className="btn btn-secondary btn-small" onClick={onAdd}><Plus size={15} />{label}</button>}</div>;
}

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [selectedDate, setSelectedDate] = useState(today());
  const month = selectedDate.slice(0, 7);
  const [state, setState] = useState<State>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState(false);
  const [settlementTab, setSettlementTab] = useState<'unpaid' | 'paid'>('paid');
  const [bookingScope, setBookingScope] = useState<'month' | 'day'>('month');
  const [display, setDisplay] = useState<'calendar' | 'list'>('calendar');
  const hasCalendar = view === 'overview' || view === 'appointments';
  const showCalendar = hasCalendar && (view === 'overview' || display === 'calendar');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api<State>(`/state?month=${month}`).then(data => { if (active) setState(data); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, refresh]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); } }, [toast]);

  const navigate = (target: View) => { setView(target); setDialog(null); setMenu(false); setQuery(''); setDisplay('calendar'); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const saved = (message: string, returnToDay = false) => { setDialog(returnToDay && showCalendar ? { type: 'day' } : null); setRefresh(v => v + 1); setToast(message); };
  const changeMonth = (next: string) => setSelectedDate(next === today().slice(0, 7) ? today() : `${next}-01`);
  const monthlyAppointments = state.appointments.filter(a => a.date.startsWith(month));
  const pending = monthlyAppointments.filter(a => a.paymentStatus === 'unpaid' && a.status !== 'cancelled');
  const completedVisits = monthlyAppointments.filter(a => a.status === 'completed');
  const paid = state.appointments.filter(a => a.paymentStatus === 'paid' && a.paidDate?.startsWith(month));
  const expenses = state.expenses.filter(e => e.date.startsWith(month));
  const appointmentRows = (view === 'settlement' ? settlementTab === 'paid' ? completedVisits : pending : monthlyAppointments.filter(a => bookingScope === 'month' || a.date === selectedDate)).filter(a => `${a.dogName} ${a.guardianName} ${a.phone}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const ledger = [...paid.map(a => ({ id: `a${a.id}`, date: a.paidDate!, category: '미용 매출', description: `${a.dogName} · ${a.service}`, method: paymentLabels[a.paymentMethod!], amount: a.price, expenseId: null as string | null })), ...expenses.map(e => ({ id: `e${e.id}`, date: e.date, category: e.category, description: e.memo || e.category, method: '지출', amount: -e.amount, expenseId: e.id }))].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const summary = state.summary;

  function exportCsv() {
    const cell = (value: string | number) => `"${String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;
    const rows = [['날짜', '구분', '분류', '내용', '결제수단', '수입(원)', '지출(원)'], ...ledger.map(r => [r.date, r.expenseId === null ? '수입' : '지출', r.category, r.description, r.method, r.expenseId === null ? r.amount : '', r.expenseId !== null ? -r.amount : ''])];
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `몽글_가계부_${month}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast('이번 달 가계부를 내려받았어요.');
  }

  const metrics = <div className="metrics">
    {[{ label: '정산된 매출', value: summary.revenue, icon: ArrowUpRight, color: 'green', detail: `결제 완료 ${summary.paidCount}건`, tag: '실제 받은 금액' }, { label: '기록한 지출', value: summary.totalExpenses, icon: ArrowDownLeft, color: 'peach', detail: `이번 달 지출 ${expenses.length}건`, tag: '가게 운영 비용' }, { label: '가게 잔액', value: summary.profit, icon: Wallet, color: 'lavender', detail: '정산 매출 − 기록한 지출', tag: '이번 달 현금 흐름' }, { label: '미정산 금액', value: summary.unpaidAmount, icon: Clock3, color: 'sand', detail: `정산 대기 ${pending.length}건`, tag: '예약일 기준' }].map(({ label, value, icon: Icon, color, detail, tag }) => <article className={`metric ${color}`} key={label}><div className="metric-top"><span>{label}</span><div className="metric-icon"><Icon size={18} /></div></div><div className="metric-value">{money(value)}<small>원</small></div><div className="metric-bottom"><span>{detail}</span><span className="metric-tag">{tag}</span></div></article>)}
  </div>;

  function bookingTable() {
    return appointmentRows.length ? <div className="table-scroll"><table className="bookings-table"><thead><tr><th>반려견 · 보호자</th><th>예약 일시</th><th>서비스</th><th>금액</th><th>{view === 'settlement' && settlementTab === 'paid' ? '결제일 · 수단' : '상태'}</th><th><span className="sr-only">관리</span></th></tr></thead><tbody>{appointmentRows.map(a => <tr key={a.id}><td><div className="pet-cell"><div className="pet-avatar"><Dog size={22} /></div><div><button className="pet-name" onClick={() => setDialog({ type: 'details', appointment: a })}>{a.dogName}</button><span>{a.guardianName}{a.breed ? ` · ${a.breed}` : ''}</span></div></div></td><td><strong>{shortDate(a.date)} <span className="normal">{a.time}</span></strong><span className="cell-sub">{a.duration}분 소요</span></td><td>{a.service}</td><td className="money-cell">{money(a.price)}원</td><td>{view === 'settlement' && settlementTab === 'paid' ? <><strong>{shortDate(a.paidDate!)}</strong><span className="cell-sub">{paymentLabels[a.paymentMethod!]}</span></> : <span className={`badge ${a.status === 'cancelled' ? 'cancelled' : a.paymentStatus === 'paid' ? 'paid' : 'scheduled'}`}>{a.status === 'cancelled' ? '예약 취소' : a.paymentStatus === 'paid' ? '미용 완료' : '예약 확정'}</span>}</td><td>{a.status !== 'cancelled' && a.paymentStatus === 'unpaid' && <div className="row-actions"><button className="btn btn-small btn-soft" onClick={() => setDialog({ type: 'settle', appointment: a })}>미용 완료</button><button className="icon-button" aria-label={`${a.dogName} 예약 수정`} onClick={() => setDialog({ type: 'appointment', appointment: a })}><Settings2 size={16} /></button><button className="icon-button subtle-danger" aria-label={`${a.dogName} 예약 취소`} onClick={() => setDialog({ type: 'cancel', appointment: a })}><X size={16} /></button></div>}</td></tr>)}</tbody></table></div> : <Empty title={query ? '검색 결과가 없어요' : view === 'settlement' ? settlementTab === 'unpaid' ? '대기 중인 예약이 없어요' : '아직 완료한 미용이 없어요' : '아직 등록된 예약이 없어요'} detail={query ? '반려견 이름, 보호자 이름 또는 연락처를 확인해 주세요.' : view === 'settlement' ? '예약에서 미용 완료와 결제를 확인하면 이 장부에 기록돼요.' : '첫 예약을 등록하고 우리 가게의 하루를 시작해 보세요.'} onAdd={view === 'appointments' && !query ? () => setDialog({ type: 'appointment' }) : undefined} />;
  }

  return <div className={`app-shell ${showCalendar ? 'calendar-screen' : ''}`}>
    {menu && <button className="sidebar-scrim" aria-label="메뉴 닫기" onClick={() => setMenu(false)} />}
    <aside className={`sidebar ${menu ? 'open' : ''}`}><button className="brand" onClick={() => navigate('overview')}><span className="brand-icon"><PawPrint size={26} fill="currentColor" /></span><span>몽글<small>우리 가게의 다정한 기록</small></span></button><div className="sidebar-label">MY GROOMING STUDIO</div><nav aria-label="주 메뉴">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => navigate(id)}><Icon size={19} /><span>{label}</span>{view === id && <i />}</button>)}</nav><div className="sidebar-note"><div className="little-paw"><PawPrint size={26} /></div><p>미용에 더 집중할 수 있게,<br /><strong>기록은 몽글과 함께.</strong></p><div className="note-line" /></div><div className="sidebar-bottom"><button className={`nav-item ${view === 'guide' ? 'active' : ''}`} onClick={() => navigate('guide')}><CircleHelp size={19} />사용 안내</button><div className="store-profile"><div className="store-avatar"><ScissorsIcon /></div><div><strong>나의 미용실</strong><span>1인 매장 관리</span></div><Leaf size={15} /></div></div></aside>
    <div className="workspace"><header className="topbar"><button className="app-brand" aria-label="몽글 캘린더로 이동" onClick={() => navigate('overview')}><span className="app-brand-mark"><PawPrint size={23} /></span><span>몽글<small>나의 미용실</small></span></button><div className="topbar-context">{navigation.find(n => n.id === view)?.label || '사용 안내'}</div><div className="topbar-right">{isDemo && <button className="demo-status" onClick={() => setDialog({ type: 'demoInfo' })} aria-label="체험판 안내"><span />체험판</button>}<button className="store-menu-button" aria-label="메뉴 열기" onClick={() => setDialog({ type: 'more' })}><Menu size={22} /></button></div></header>
      <main><div className="page-heading"><div><div className="eyebrow">우리 가게의 다정한 기록</div><h1>{titles[view].title}<span className="heading-dot">.</span></h1><p>{titles[view].subtitle}</p></div><div className="heading-actions">{view === 'ledger' ? <button className="btn btn-primary" disabled={loading || !!error} onClick={() => setDialog({ type: 'expense' })}><Plus size={18} />지출 기록</button> : view !== 'guide' && view !== 'pricing' && view !== 'customers' && view !== 'supplies' && <button className="btn btn-primary" disabled={loading || !!error} onClick={() => setDialog({ type: 'appointment' })}><Plus size={18} />새 예약 등록</button>}</div></div>
      {error && <div className="error-banner" role="alert"><div><strong>기록을 불러오지 못했어요.</strong><p>{error}</p></div><button className="btn btn-secondary" onClick={() => setRefresh(v => v + 1)}>다시 시도</button></div>}
      {view !== 'guide' && view !== 'pricing' && view !== 'customers' && view !== 'supplies' && <div className="period-bar calendar-period-bar"><div className="period-picker"><button className="icon-button" aria-label="이전 달" disabled={month <= '2000-01'} onClick={() => changeMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></button><label className="sr-only" htmlFor="month">조회 월</label><span className="month-control"><span className="month-title"><small>{Number(month.slice(0, 4))}년</small><strong>{Number(month.slice(5))}월</strong></span><input id="month" type="month" min="2000-01" max="2100-12" value={month} onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value) && e.target.value >= '2000-01' && e.target.value <= '2100-12') changeMonth(e.target.value); }} /></span><button className="icon-button" aria-label="다음 달" disabled={month >= '2100-12'} onClick={() => changeMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></button><button className="btn btn-secondary btn-small" onClick={() => setSelectedDate(today())}>오늘</button></div><div className="calendar-period-actions">{view === 'ledger' && <button className="icon-button" disabled={!ledger.length || loading || !!error} aria-label="이번 달 가계부 CSV 내보내기" onClick={exportCsv}><ArrowDownToLine size={18} /></button>}{hasCalendar && view !== 'overview' && <div className="calendar-view-switch" aria-label="보기 방식"><button aria-pressed={display === 'calendar'} className={display === 'calendar' ? 'active' : ''} onClick={() => setDisplay('calendar')}>캘린더</button><button aria-pressed={display === 'list'} className={display === 'list' ? 'active' : ''} onClick={() => setDisplay('list')}>목록</button></div>}</div></div>}
      {loading && !error ? <div className="loading-state" role="status"><span className="loader" />가게의 기록을 가져오고 있어요…</div> : !error && <>
        {view === 'ledger' && metrics}
        {view === 'settlement' && <div className="grooming-book-summary"><div><span>미용 완료</span><strong>{completedVisits.length}<small>건</small></strong></div><div><span>완료한 미용 금액</span><strong>{money(completedVisits.reduce((sum, visit) => sum + visit.price, 0))}<small>원</small></strong></div><div><span>예약 · 결제 대기</span><strong>{pending.length}<small>건</small></strong></div></div>}
        {showCalendar && <StudioCalendar detailsOpen={dialog?.type === 'day'} onCloseDetails={() => setDialog(null)} selected={selectedDate} appointments={state.appointments} onSelect={date => { setSelectedDate(date); setDialog({ type: 'day' }); }} onAdd={() => setDialog({ type: 'appointment' })} onDetails={appointment => setDialog({ type: 'details', appointment })} onSettle={appointment => setDialog({ type: 'settle', appointment })} onEdit={appointment => setDialog({ type: 'appointment', appointment })} onCancel={appointment => setDialog({ type: 'cancel', appointment })} />}
        {((view === 'appointments' && !showCalendar) || view === 'settlement') && <section className="panel bookings-panel"><div className="list-toolbar"><div className="tabs">{view === 'settlement' ? <><button className={settlementTab === 'paid' ? 'active' : ''} onClick={() => setSettlementTab('paid')}>미용 완료 <span>{completedVisits.length}</span></button><button className={settlementTab === 'unpaid' ? 'active' : ''} onClick={() => setSettlementTab('unpaid')}>예약 · 결제 대기 <span>{pending.length}</span></button></> : <><button className={bookingScope === 'month' ? 'active' : ''} onClick={() => setBookingScope('month')}>월 전체 <span>{monthlyAppointments.length}</span></button><button className={bookingScope === 'day' ? 'active' : ''} onClick={() => setBookingScope('day')}>날짜별 보기</button></>}</div><label className="search-field"><Search size={16} /><input aria-label="예약 검색" value={query} onChange={e => setQuery(e.target.value)} placeholder="반려견 · 보호자 · 연락처 검색" />{query && <button className="icon-button" onClick={() => setQuery('')} aria-label="검색 지우기"><X size={14} /></button>}</label></div>{view === 'appointments' && bookingScope === 'day' && <div className="date-filter"><label htmlFor="filter-date">예약일</label><input id="filter-date" type="date" value={selectedDate} onChange={e => { if (e.target.value) setSelectedDate(e.target.value); }} /><button className="text-button" onClick={() => setSelectedDate(today())}>오늘</button></div>}{bookingTable()}<div className="table-footer"><span>총 {appointmentRows.length}건</span><span>{view === 'settlement' ? settlementTab === 'paid' ? '방문일 기준 · 완료한 미용 내역' : '예약일 기준 · 취소한 예약 제외' : '1인 미용 일정 · 겹치는 예약은 등록할 수 없어요'}</span></div></section>}
        {view === 'ledger' && !showCalendar && <div className="ledger-with-cost"><div className="cost-explainer compact"><div><strong>이달 정산된 방문의 샴푸 사용 원가 <b>{money(summary.shampooCost)}원</b></strong><p>운영 참고용 원가예요. 구매 지출과 중복되지 않도록 가게 잔액에서 다시 차감하지 않아요.</p></div><button className="text-button" onClick={() => navigate('supplies')}>샴푸 관리 <ArrowRight size={15} /></button></div>{!showCalendar && <section className="panel"><div className="panel-heading"><div><div className="section-eyebrow">CASH FLOW</div><h2>수입 · 지출 내역 <span className="count-pill">{ledger.length}</span></h2></div><button className="btn btn-secondary btn-small" disabled={!ledger.length} onClick={exportCsv}><ArrowDownToLine size={15} />CSV 내보내기</button></div>{ledger.length ? <div className="table-scroll"><table className="ledger-table"><thead><tr><th>날짜</th><th>분류</th><th>내용</th><th>수단</th><th>금액</th><th><span className="sr-only">관리</span></th></tr></thead><tbody>{ledger.map(row => <tr key={row.id}><td>{shortDate(row.date)}</td><td><span className={`badge ${row.expenseId === null ? 'paid' : 'expense'}`}>{row.category}</span></td><td>{row.description}</td><td className="muted">{row.method}</td><td className={`money-cell ${row.expenseId === null ? 'income-text' : 'expense-text'}`}>{row.expenseId === null ? '+' : '−'}{money(Math.abs(row.amount))}원</td><td>{row.expenseId !== null && <button className="icon-button subtle-danger" aria-label={`${row.description} 지출 삭제`} onClick={() => setDialog({ type: 'deleteExpense', id: row.expenseId! })}><Trash2 size={16} /></button>}</td></tr>)}</tbody></table></div> : <Empty title="가게의 첫 기록을 기다리고 있어요" detail="예약을 정산하면 수입이 자동으로 기록돼요. 지출도 함께 기록해 보세요." label="첫 지출 기록하기" onAdd={() => setDialog({ type: 'expense' })} />}<div className="table-footer"><span>실제 결제일 기준의 현금 흐름</span><span>가게 잔액은 세무상 순이익과 달라요</span></div></section>}</div>}
        {view === 'customers' && <CustomersPanel customers={state.customers} pets={state.pets} appointments={state.appointments} onSaved={() => saved('고객대장을 저장했어요.')} onBook={(petId) => { setSelectedDate(today()); setDialog({ type: 'appointment', petId }); }} />}
        {view === 'supplies' && <ShampoosPanel shampoos={state.shampoos} appointments={state.appointments} onSaved={() => saved('샴푸 정보를 저장했어요.')} onExpense={() => setDialog({ type: 'expense' })} />}
        {view === 'pricing' && <PricingPanel pricing={state.pricing} onSaved={() => saved('우리 가게 요금표를 저장했어요.')} />}
        {view === 'guide' && <div className="guide-grid"><section className="panel guide-panel"><div className="section-eyebrow">A LITTLE GUIDE</div><h2>아이의 첫 방문부터 다음 만남까지.</h2>{[{ n: '01', title: '고객과 반려견을 먼저 기록해요', text: '고객대장에 보호자와 아이를 등록하세요. 견종·몸무게와 알레르기, 입질 등 주의사항을 남기고 아이마다 미용 이력을 확인할 수 있어요. 한 보호자에게 여러 반려견을 연결할 수 있어요.' }, { n: '02', title: '아이와 만날 시간을 등록해요', text: '예약 일정에서 반려견·보호자 정보와 미용 서비스, 시간, 예상 금액을 입력하세요. 서비스별 기본 시간과 금액은 예약마다 수정할 수 있어요.' }, { n: '03', title: '사용한 샴푸와 추가 작업을 남겨요', text: '샴푸 관리에서 실제 제품 가격과 용량을 등록한 뒤 예약에 원액 사용량과 고객 추가요금을 기록하세요. 입질·엉킴 등 현장 추가 작업도 사유와 함께 남길 수 있어요. 기존 방문의 원가는 제품 가격을 바꿔도 유지돼요.' }, { n: '04', title: '미용을 마치면 결제를 확인해요', text: '날짜별 예약에서 미용 완료를 누르고 최종 금액·결제 수단·실제 결제일을 확인하세요. 완료 내역은 방문일 기준 미용 장부에, 받은 금액은 결제일 기준 운영비·손익에 반영돼요. 완료 후 수정과 환불은 아직 지원하지 않아요.' }, { n: '05', title: '가게를 위해 쓴 돈을 남겨요', text: '더보기의 운영비·손익에서 미용 용품, 임대료 등 매장 지출을 기록하세요. 실제 받은 미용 대금과 기록한 비용을 확인하고, 월별 내역을 CSV로 내려받을 수 있어요.' }].map(item => <div className="guide-step" key={item.n}><span>{item.n}</span><div><h3>{item.title}</h3><p>{item.text}</p></div></div>)}</section><section className="panel guide-panel"><span className="naver-icon">N</span><h2>네이버 예약 연동 계획</h2><p>현재는 직접 등록한 예약을 관리하는 첫 버전이에요. 네이버 예약 자동 연동은 아직 제공하지 않아요.</p><ul><li>공식 연동 가능 여부와 사업자 권한 확인</li><li>외부 예약 번호로 중복 가져오기 방지</li><li>예약 변경·취소와 매장 일정 동기화</li><li>연동 오류 알림과 수동 확인 기능</li></ul><div className="guide-callout"><strong>현재 버전의 사용 범위</strong><p>{isDemo ? '이 페이지는 기능을 시험하는 공유 체험판이에요. 예시 데이터와 직접 입력한 기록은 현재 브라우저에만 저장돼요. 기기를 바꾸거나 사이트 저장 공간을 지우면 기록을 이어서 볼 수 없어요. 실제 매장 고객 정보는 입력하지 마세요.' : '한 대의 기기에서 사용하는 매장 내부용 앱이에요. 여러 기기에서 함께 쓰려면 로그인과 서버 운영 설정이 필요해요. 기록은 서버의 SQLite 데이터베이스에 저장되므로 정기적으로 백업해 주세요.'}</p></div></section></div>}
      </>}
      <footer className="page-footer"><span><PawPrint size={13} /> 몽글 · 우리 가게의 다정한 기록</span><span>작은 발자국, 차곡차곡 쌓이는 하루.</span></footer></main></div>
    <MobileNavigation active={view} onNavigate={navigate} onMore={() => setDialog({ type: 'more' })} />
    <QuickAddButton label={view === 'customers' ? '고객 등록' : view === 'ledger' || view === 'supplies' ? '지출 기록' : '예약 등록'} disabled={loading || !!error || ((view === 'ledger' || view === 'supplies') && selectedDate > today())} onClick={() => setDialog({ type: view === 'customers' ? 'newCustomer' : view === 'ledger' || view === 'supplies' ? 'expense' : 'appointment' })} />
    {dialog?.type === 'newCustomer' && <PetForm customers={state.customers} onClose={() => setDialog(null)} onSaved={() => saved('새로운 단골을 등록했어요.')} />}
    {dialog?.type === 'more' && <Modal title="우리 가게 메뉴" description="필요한 기록으로 바로 이동해요." onClose={() => setDialog(null)} className="more-sheet"><nav className="more-menu" aria-label="전체 메뉴">{navigation.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => navigate(id)} aria-current={view === id ? 'page' : undefined}><Icon size={22} /><span>{label}</span><ChevronRight size={17} /></button>)}<button onClick={() => navigate('guide')}><CircleHelp size={22} /><span>사용 안내</span><ChevronRight size={17} /></button></nav></Modal>}
    {isDemo && dialog?.type === 'demoInfo' && <Modal title="예시 데이터로 둘러보세요" onClose={() => setDialog(null)} className="demo-info-sheet"><div className="modal-body"><p>테스트 기록은 이 브라우저에만 저장돼요. 다른 사람과 공유되지 않으며, 실제 고객 정보는 입력하지 마세요.</p><div className="demo-info-note"><PawPrint size={23} /><p>날짜를 눌러 하루의 기록을 보고,<br />오른쪽 아래 ＋로 바로 예약을 잡으세요.</p></div></div><footer className="modal-footer"><button className="btn btn-secondary" onClick={() => setDialog({ type: 'demoReset' })}>체험 데이터 초기화</button><button className="btn btn-primary" onClick={() => setDialog(null)}>둘러보기</button></footer></Modal>}
    {isDemo && dialog?.type === 'demoReset' && <ConfirmDialog title="체험 데이터를 초기화할까요?" description="이 브라우저에서 입력한 체험 기록을 지우고 예시 데이터로 되돌려요. 다른 사람의 기록에는 영향을 주지 않아요." confirmLabel="예시 데이터로 초기화" onClose={() => setDialog(null)} onConfirm={async () => { const { resetDemoData } = await import('./demo/api'); await resetDemoData(); setSelectedDate(today()); saved('예시 데이터로 다시 시작해요.'); }} />}
    {dialog?.type === 'details' && <AppointmentDetails appointment={dialog.appointment} onClose={() => setDialog(null)} onEdit={() => setDialog({ type: 'appointment', appointment: dialog.appointment })} onSettle={() => setDialog({ type: 'settle', appointment: dialog.appointment })} />}
    {dialog?.type === 'appointment' && <AppointmentForm customers={state.customers} pets={state.pets} shampoos={state.shampoos} defaultPetId={dialog.petId} pricing={state.pricing} initial={dialog.appointment} date={selectedDate} onClose={() => setDialog(null)} onSaved={() => saved(dialog.appointment ? '예약을 수정했어요.' : '새 예약을 등록했어요.', !!dialog.appointment)} />}
    {dialog?.type === 'expense' && <ExpenseForm date={selectedDate} onClose={() => setDialog(null)} onSaved={() => saved('지출을 기록했어요.')} />}
    {dialog?.type === 'settle' && <SettleForm appointment={dialog.appointment} onClose={() => setDialog(null)} onSaved={() => saved('미용 완료와 결제를 기록했어요.', true)} />}
    {dialog?.type === 'cancel' && <ConfirmDialog title={`${dialog.appointment.dogName} 예약을 취소할까요?`} description="취소한 예약은 기록으로 남으며 해당 시간에 다른 예약을 받을 수 있어요." confirmLabel="예약 취소" onClose={() => setDialog(null)} onConfirm={async () => { await api(`/appointments/${dialog.appointment.id}`, 'PATCH', { status: 'cancelled' }); saved('예약을 취소했어요.'); }} />}
    {dialog?.type === 'deleteExpense' && <ConfirmDialog title="지출 기록을 삭제할까요?" description="삭제하면 가계부와 월 지출 합계에서 제외돼요. 이 작업은 되돌릴 수 없어요." confirmLabel="지출 삭제" onClose={() => setDialog(null)} onConfirm={async () => { await api(`/expenses/${dialog.id}`, 'DELETE'); saved('지출 기록을 삭제했어요.'); }} />}
    {toast && <div className="toast" role="status"><Check size={17} />{toast}<button aria-label="알림 닫기" onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>;
}

function ScissorsIcon() { return <><span className="profile-paw"><PawPrint size={20} /></span></>; }
