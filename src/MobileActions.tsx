import { CalendarDays, Ellipsis, Plus, ReceiptText, UsersRound } from 'lucide-react';

const tabs = [
  { id: 'overview', label: '예약', icon: CalendarDays },
  { id: 'customers', label: '고객', icon: UsersRound },
  { id: 'settlement', label: '미용 장부', icon: ReceiptText },
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

export function QuickAddButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return <button type="button" className="quick-add" aria-label={label} aria-haspopup="dialog" data-primary-add disabled={disabled} onClick={onClick}><Plus size={24} strokeWidth={2.3} /><span>{label}</span></button>;
}
