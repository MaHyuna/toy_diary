import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus, Settings2, X } from 'lucide-react';
import { monthDays } from './calendar';
import type { CalendarDay } from './calendar';
import type { Appointment } from './types';
import { money, paymentLabels, today } from './types';
import { Modal } from './Forms';

type Props = {
  selected: string;
  appointments: Appointment[];
  detailsOpen: boolean;
  actionsDisabled?: boolean;
  onCloseDetails: () => void;
  onSelect: (date: string) => void;
  onAdd: () => void;
  onDetails: (appointment: Appointment) => void;
  onSettle: (appointment: Appointment) => void;
  onEdit: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
};

type AgendaProps = Pick<Props, 'onAdd' | 'onDetails' | 'onSettle' | 'onEdit' | 'onCancel' | 'actionsDisabled'> & {
  day: CalendarDay;
  compact?: boolean;
};

const compactMoney = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 });
const shortDate = (date: string) => `${Number(date.slice(5, 7))}.${Number(date.slice(8))}`;
const dateLabel = (date: string) => new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'UTC', month: 'long', day: 'numeric', weekday: 'long',
}).format(new Date(`${date}T12:00:00Z`));
const moveDate = (date: string, delta: number) => {
  const target = new Date(`${date}T12:00:00Z`);
  target.setUTCDate(target.getUTCDate() + delta);
  return target.toISOString().slice(0, 10);
};
const sourceLabel = (appointment: Appointment) => appointment.source === 'website' ? '고객 예약'
  : appointment.source === 'naver' ? '네이버' : '직접 등록';

/** The same visit actions appear in the desktop agenda and mobile day sheet. */
function DayAgenda({ day, compact = false, onAdd, onDetails, onSettle, onEdit, onCancel, actionsDisabled = false }: AgendaProps) {
  const showPaymentRecords = day.payments.some(visit => visit.date !== day.date);
  return <section className="grooming-day" aria-label="선택한 날의 미용 예약">
    <div className="day-money-summary">
      <div><span>결제 금액<small>결제일 기준</small></span><strong>{money(day.income)}원</strong></div>
      <div><span>예약 예상<small>방문일 기준</small></span><strong>{money(day.bookingAmount)}원</strong></div>
    </div>
    {!compact && <div className="grooming-day-total"><span>시간순 예약 {day.appointments.length}건</span>
      <button className="btn btn-soft btn-small" disabled={actionsDisabled} onClick={onAdd}><Plus size={16} />예약 추가</button>
    </div>}
    {day.appointments.length ? <div className="grooming-visits">
      {day.appointments.map(appointment => <article
        className={`grooming-visit ${appointment.status === 'completed' ? 'is-complete' : ''}`} key={appointment.id}
      >
        <button type="button" className="visit-open" aria-label={`${appointment.dogName} 예약 상세 보기`} onClick={() => onDetails(appointment)}>
          <time>{appointment.time}</time>
          <span className="visit-open-info">
            <strong>{appointment.dogName}</strong>
            <span>{appointment.service}{appointment.weight ? ` · ${appointment.weight}kg` : ''}</span>
            <small>{appointment.guardianName} · {appointment.duration}분</small>
            <span className="source-tag">{sourceLabel(appointment)}</span>
          </span>
          <span className="visit-open-price"><b>{money(appointment.price)}원</b><small>상세 보기 <ChevronRight size={13} /></small></span>
        </button>
        <div className="visit-card-actions">
          {appointment.paymentStatus === 'paid'
            ? <span className="grooming-done"><Check size={12} />완료 · {paymentLabels[appointment.paymentMethod!]}</span>
            : <>
              <button className="text-button" disabled={actionsDisabled} onClick={() => onEdit(appointment)} aria-label={`${appointment.dogName} 예약·요금 수정`}><Settings2 size={13} />수정</button>
              <button className="text-button" disabled={actionsDisabled} onClick={() => onCancel(appointment)} aria-label={`${appointment.dogName} 예약 취소`}><X size={13} />취소</button>
              <button className="btn btn-primary btn-small" disabled={actionsDisabled} onClick={() => onSettle(appointment)}>미용 완료</button>
            </>}
        </div>
      </article>)}
    </div> : day.payments.length > 0 ? <div className="calendar-no-visits"><p>이날 방문 예약은 없어요. 아래에서 받은 결제를 확인하세요.</p></div> : <div className="grooming-empty">
      <span className="calendar-empty-icon"><CalendarDays size={25} /></span>
      <h3>아직 잡힌 예약이 없어요</h3>
      <p>시간을 비워 두거나 새로운 예약을 등록하세요.</p>
      {!compact && <button className="btn btn-soft" disabled={actionsDisabled} onClick={onAdd}><Plus size={17} />이날 예약 잡기</button>}
    </div>}
    {showPaymentRecords && <section className="day-payment-records" aria-label="이날 받은 결제 내역">
      <div className="day-payment-heading"><h3>이날 받은 결제</h3><p>미용일이 다른 방문의 결제가 포함되어 있어요.</p></div>
      {day.payments.map(visit => <button type="button" className="day-payment-row" key={visit.id} onClick={() => onDetails(visit)} aria-label={`${visit.dogName} 결제 내역 상세 보기`}>
        <span><strong>{visit.dogName}</strong><small>미용일 {shortDate(visit.date)} · {paymentLabels[visit.paymentMethod!]}</small></span>
        <b>{money(visit.price)}원</b><ChevronRight size={14} />
      </button>)}
    </section>}
  </section>;
}

export function StudioCalendar(props: Props) {
  const { selected, appointments, onSelect } = props;
  const [amountView, setAmountView] = useState<'income' | 'bookingAmount'>('income');
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1100px)').matches);
  const [previewBudget, setPreviewBudget] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const agendaTitle = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const month = selected.slice(0, 7);
  const days = monthDays(month, appointments, []);
  const selectedDay = days.find(day => day.date === selected)!;
  const offset = new Date(`${month}-01T12:00:00Z`).getUTCDay();
  const padding = (7 - (offset + days.length) % 7) % 7;
  const completed = days.reduce((sum, day) => sum + day.completedCount, 0);
  const bookingCount = days.reduce((sum, day) => sum + day.appointments.length, 0);
  const currentDay = today();
  const dayProps = { day: selectedDay, actionsDisabled: props.actionsDisabled, onAdd: props.onAdd, onDetails: props.onDetails, onSettle: props.onSettle, onEdit: props.onEdit, onCancel: props.onCancel };

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1100px)');
    const update = () => setDesktop(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!desktop) { setPreviewBudget(0); return; }
    const cell = root.current?.querySelector<HTMLButtonElement>('.month-day');
    if (!cell) return;
    const update = () => {
      const height = cell.getBoundingClientRect().height;
      setPreviewBudget(height >= 110 ? 2 : height >= 80 ? 1 : 0);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(cell);
    return () => observer.disconnect();
  }, [desktop, month]);
  useEffect(() => {
    if (pendingFocus.current === selected) {
      root.current?.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)?.focus({ preventScroll: true });
      pendingFocus.current = null;
    }
  }, [selected]);

  function handleDayKey(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    if (!desktop) return;
    const direction: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in direction) {
      event.preventDefault();
      const target = moveDate(date, direction[event.key]);
      if (target < '2000-01-01' || target > '2100-12-31') return;
      pendingFocus.current = target;
      onSelect(target);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onSelect(date);
      requestAnimationFrame(() => agendaTitle.current?.focus({ preventScroll: true }));
    }
  }

  return <div ref={root} className="studio-calendar grooming-calendar calendar-workspace" data-calendar-desktop={desktop}>
    <section className="panel month-calendar" aria-label="월간 예약 캘린더">
      <div className="calendar-amount-toolbar">
        <div role="group" aria-label="달력 금액 기준">
          <button aria-pressed={amountView === 'income'} onClick={() => setAmountView('income')}>결제 매출</button>
          <button aria-pressed={amountView === 'bookingAmount'} onClick={() => setAmountView('bookingAmount')}>예약 예상</button>
        </div>
        <span>이달 <strong>{money(days.reduce((sum, day) => sum + day[amountView], 0))}원</strong></span>
      </div>
      <div className="month-weekdays" aria-hidden="true">{['일', '월', '화', '수', '목', '금', '토'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="month-cells" data-weeks={(offset + days.length + padding) / 7}>
        {Array.from({ length: offset }, (_, index) => <div className="month-blank" key={`before-${index}`} />)}
        {days.map(day => <button
          key={day.date} type="button" data-date={day.date}
          className={`month-day ${selected === day.date ? 'is-selected' : ''} ${currentDay === day.date ? 'is-current' : ''}`}
          tabIndex={desktop ? selected === day.date ? 0 : -1 : 0}
          aria-pressed={selected === day.date} aria-current={currentDay === day.date ? 'date' : undefined}
          aria-haspopup={desktop ? undefined : 'dialog'}
          aria-controls={desktop ? 'selected-day-agenda' : undefined}
          aria-label={`${dateLabel(day.date)}, 예약 ${day.appointments.length}건, 결제 매출 ${money(day.income)}원, 예약 예상 ${money(day.bookingAmount)}원, 미용 완료 ${day.completedCount}건`}
          onClick={() => onSelect(day.date)}
          onKeyDown={event => handleDayKey(event, day.date)}
        >
          <span className="month-day-heading">
            <span className="month-day-number">{Number(day.date.slice(8))}</span>
            {day.date === currentDay && <span className="calendar-cell-today">오늘</span>}
          </span>
          {(day.appointments.length > 0 || day.income > 0) && <>
            <span className="month-day-bookings"><span className={`month-booking-count ${day.completedCount === day.appointments.length ? 'all-complete' : ''}`}>{day.appointments.length}건</span></span>
            <span className="month-revenue" title={`${money(day[amountView])}원`}>{amountView === 'bookingAmount' && <small>예상</small>}{day[amountView] >= 1_000_000 ? compactMoney.format(day[amountView]) : money(day[amountView])}</span>
          </>}
          {desktop && previewBudget > 0 && day.appointments.length > 0 && <span
            className={`calendar-cell-preview ${day.appointments.length > previewBudget ? 'has-more' : ''}`}
            data-preview-count={Math.min(day.appointments.length, previewBudget)} aria-hidden="true"
          >
            {day.appointments.slice(0, previewBudget).map((visit, index) => <span
              className={`calendar-cell-event ${visit.paymentStatus === 'paid' ? 'is-paid' : ''} ${index === Math.min(day.appointments.length, previewBudget) - 1 ? 'is-last-preview' : ''}`}
              key={visit.id}
            ><time>{visit.time}</time><span className="calendar-cell-name">{visit.dogName}</span>
              {index === previewBudget - 1 && day.appointments.length > previewBudget && <span className="calendar-cell-more">+{day.appointments.length - previewBudget}</span>}
            </span>)}
          </span>}

        </button>)}
        {Array.from({ length: padding }, (_, index) => <div className="month-blank" key={`after-${index}`} />)}
      </div>
      <div className="grooming-calendar-caption">
        <span>예약 <strong>{bookingCount}건</strong> · 미용 완료 <strong>{completed}건</strong></span>
        <span>결제: 결제일 · 예상: 방문일</span>
      </div>
    </section>

    {desktop && <aside className="calendar-day-panel" id="selected-day-agenda" aria-label="선택한 날의 일정">
      <header className="calendar-day-panel-header">
        <div className="calendar-day-title" aria-live="polite" aria-atomic="true"><span className="calendar-day-eyebrow">{selected === currentDay ? '오늘의 일정' : '선택한 일정'}</span>
          <h2 ref={agendaTitle} tabIndex={-1}>{dateLabel(selected)}</h2>
          <p>{selectedDay.appointments.length}건의 예약</p>
        </div>
        <div className="calendar-day-nav">
          <button className="icon-button" aria-label="이전 날짜" disabled={selected <= '2000-01-01'} onClick={() => onSelect(moveDate(selected, -1))}><ChevronLeft size={17} /></button>
          <button className="icon-button" aria-label="다음 날짜" disabled={selected >= '2100-12-31'} onClick={() => onSelect(moveDate(selected, 1))}><ChevronRight size={17} /></button>
        </div>
      </header>
      <div className="calendar-day-panel-meta"><span className="calendar-day-progress">미용 완료 {selectedDay.completedCount}건 · 대기 {selectedDay.appointments.length - selectedDay.completedCount}건</span>
        <button className="calendar-day-add btn btn-primary btn-small" disabled={props.actionsDisabled} onClick={props.onAdd}><Plus size={16} />예약 추가</button>
      </div>
      <div className="calendar-day-panel-body calendar-agenda-enter" key={selected}><DayAgenda {...dayProps} compact /></div>
    </aside>}

    {!desktop && props.detailsOpen && <Modal title={dateLabel(selected)} description={`예약 ${selectedDay.appointments.length}건 · 미용 완료 ${selectedDay.completedCount}건`} onClose={props.onCloseDetails} className="grooming-day-sheet">
      <DayAgenda {...dayProps} />
    </Modal>}
  </div>;
}
