import { CalendarDays, ChevronRight, CreditCard, Ellipsis, Plus, ReceiptText, UsersRound } from 'lucide-react';
import { Modal } from './Forms';
import { today } from './types';

const tabs = [
  { id: 'overview', label: '캘린더', icon: CalendarDays },
  { id: 'ledger', label: '가계부', icon: ReceiptText },
  { id: 'customers', label: '고객', icon: UsersRound },
  { id: 'settlement', label: '정산', icon: CreditCard },
] as const;

export function MobileNavigation({ active, onNavigate, onMore }: {
  active: string;
  onNavigate: (view: typeof tabs[number]['id']) => void;
  onMore: () => void;
}) {
  return <nav className="mobile-navigation" aria-label="하단 메뉴">
    {tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-current={active === id ? 'page' : undefined} onClick={() => onNavigate(id)}><span><Icon size={22} strokeWidth={active === id ? 2.2 : 1.8} /></span>{label}</button>)}
    <button type="button" aria-haspopup="dialog" onClick={onMore}><span><Ellipsis size={23} /></span>더보기</button>
  </nav>;
}

export function QuickAddButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return <button type="button" className="quick-add" aria-label="새 기록 추가" aria-haspopup="dialog" data-primary-add disabled={disabled} onClick={onClick}><Plus size={28} strokeWidth={2.3} /><span>새 기록</span></button>;
}

export function RegistrationMenu({ date, onClose, onAppointment, onExpense, onCustomer }: {
  date: string;
  onClose: () => void;
  onAppointment: () => void;
  onExpense: () => void;
  onCustomer: () => void;
}) {
  const formatted = new Intl.DateTimeFormat('ko-KR', { timeZone: 'UTC', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${date}T12:00:00Z`));
  const future = date > today();
  return <Modal title="무엇을 기록할까요?" description={`${formatted} · 선택한 날짜`} onClose={onClose} className="quick-create-sheet">
    <div className="quick-create-options">
      <button type="button" onClick={onAppointment}><span className="action-symbol appointment-symbol"><CalendarDays size={24} /></span><span><strong>예약 등록</strong><small>아이와 만날 시간을 잡아요</small></span><ChevronRight size={18} /></button>
      <button type="button" disabled={future} onClick={onExpense}><span className="action-symbol expense-symbol"><ReceiptText size={24} /></span><span><strong>지출 기록</strong><small>{future ? '지출은 오늘까지의 날짜로 기록해요' : '가게를 위해 쓴 돈을 남겨요'}</small></span><ChevronRight size={18} /></button>
      <button type="button" onClick={onCustomer}><span className="action-symbol customer-symbol"><UsersRound size={24} /></span><span><strong>고객 · 반려견 등록</strong><small>새로운 단골을 기록해요</small></span><ChevronRight size={18} /></button>
    </div>
  </Modal>;
}
