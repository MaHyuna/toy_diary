import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { shiftMonth } from './calendar';
import { today } from './types';

/** Inline calendar: selecting a date is explicit and never opens the browser popup. */
export function DatePicker({ value, max = today(), min = '2000-01-01', disabled, onChange, onClose }: {
  value: string; max?: string; min?: string; disabled?: boolean; onChange: (date: string) => void; onClose?: () => void;
}) {
  const [month, setMonth] = useState(value.slice(0, 7));
  const [focused, setFocused] = useState(value);
  const root = useRef<HTMLFieldSetElement>(null);
  const focusPending = useRef(false);
  const offset = new Date(`${month}-01T12:00:00Z`).getUTCDay();
  const count = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0, 12)).getUTCDate();
  const inRange = (date: string) => date >= min && date <= max;
  const changeMonth = (target: string) => setMonth(target < min.slice(0, 7) ? min.slice(0, 7) : target > max.slice(0, 7) ? max.slice(0, 7) : target);
  const focusDate = focused.startsWith(month) ? focused : `${month}-01` < min ? min : `${month}-01`;
  useEffect(() => {
    if (focusPending.current) {
      root.current?.querySelector<HTMLButtonElement>(`[data-picker-date="${focused}"]`)?.focus();
      focusPending.current = false;
    }
  }, [focused, month]);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const directions: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in directions)) return;
    event.preventDefault();
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + directions[event.key]);
    const target = next.toISOString().slice(0, 10);
    if (!inRange(target)) return;
    focusPending.current = true; setMonth(target.slice(0, 7)); setFocused(target);
  }
  return <fieldset ref={root} className="inline-datepicker" aria-label="실제 결제일" disabled={disabled} onKeyDown={event => {
    if (event.key === 'Escape' && onClose) { event.preventDefault(); event.stopPropagation(); onClose(); }
  }}>
    <legend className="sr-only">실제 결제일</legend>
    <div className="datepicker-toolbar">
      <button type="button" className="icon-button" aria-label="결제일 이전 달" disabled={disabled || month <= min.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></button>
      <div className="datepicker-period"><select aria-label="결제 연도" value={month.slice(0, 4)} onChange={event => changeMonth(`${event.target.value}-${month.slice(5)}`)} disabled={disabled}>
        {Array.from({ length: Number(max.slice(0, 4)) - Number(min.slice(0, 4)) + 1 }, (_, index) => Number(max.slice(0, 4)) - index).map(year => <option key={year} value={year}>{year}년</option>)}
      </select><select aria-label="결제 월" value={month.slice(5)} onChange={event => setMonth(`${month.slice(0, 4)}-${event.target.value}`)} disabled={disabled}>
        {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map(number => <option key={number} value={number} disabled={`${month.slice(0, 4)}-${number}` < min.slice(0, 7) || `${month.slice(0, 4)}-${number}` > max.slice(0, 7)}>{Number(number)}월</option>)}
      </select></div>
      <button type="button" className="icon-button" aria-label="결제일 다음 달" disabled={disabled || month >= max.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></button>
    </div>
    <div className="datepicker-weekdays" aria-hidden="true">{['일', '월', '화', '수', '목', '금', '토'].map(day => <span key={day}>{day}</span>)}</div>
    <div className="datepicker-days">
      {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
      {Array.from({ length: count }, (_, index) => {
        const date = `${month}-${String(index + 1).padStart(2, '0')}`;
        return <button key={date} type="button" data-picker-date={date} aria-label={`${Number(month.slice(0, 4))}년 ${Number(month.slice(5))}월 ${index + 1}일`}
          aria-pressed={date === value} aria-current={date === today() ? 'date' : undefined} tabIndex={date === focusDate ? 0 : -1}
          disabled={disabled || !inRange(date)} onFocus={() => setFocused(date)} onKeyDown={event => navigate(event, date)} onClick={() => onChange(date)}>{index + 1}</button>;
      })}
    </div>
    <button type="button" className="datepicker-today text-button" disabled={disabled || !inRange(today())} onClick={() => onChange(today())}>오늘로</button>
  </fieldset>;
}
