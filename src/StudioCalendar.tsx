import { CalendarDays, Check, Clock3, Plus, Settings2, Trash2, X } from 'lucide-react';
import { monthDays } from './calendar';
import type { Appointment, Expense } from './types';
import { money, paymentLabels, today } from './types';

type Props = {
  mode: 'overview' | 'appointments' | 'ledger';
  selected: string;
  appointments: Appointment[];
  expenses: Expense[];
  onSelect: (date: string) => void;
  onAdd: () => void;
  onExpense: () => void;
  onDetails: (appointment: Appointment) => void;
  onSettle: (appointment: Appointment) => void;
  onEdit: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onDeleteExpense: (id: string) => void;
};

const dateLabel = (date: string) => new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'UTC', month: 'long', day: 'numeric', weekday: 'long',
}).format(new Date(`${date}T12:00:00Z`));

export function StudioCalendar(props: Props) {
  const { selected, mode, appointments, expenses, onSelect } = props;
  const month = selected.slice(0, 7);
  const currentDay = today();
  const days = monthDays(month, appointments, expenses);
  const selectedDay = days.find(day => day.date === selected)!;
  const offset = new Date(`${month}-01T12:00:00Z`).getUTCDay();
  const padding = (7 - (offset + days.length) % 7) % 7;
  const showBookings = mode !== 'ledger';
  const income = days.reduce((total, day) => total + day.income, 0);
  const spending = days.reduce((total, day) => total + day.spending, 0);

  return <div className={`studio-calendar calendar-mode-${mode}`}>
    <section className="panel month-calendar" aria-label="월간 캘린더">
      <div className="calendar-summary">
        <div><span>이번 달 수입</span><strong className="calendar-income">+{money(income)}<small>원</small></strong></div>
        <div><span>이번 달 지출</span><strong className="calendar-spending">−{money(spending)}<small>원</small></strong></div>
        <div><span>수입 − 지출</span><strong>{money(income - spending)}<small>원</small></strong></div>
      </div>
      <div className="month-weekdays" aria-hidden="true">{['일', '월', '화', '수', '목', '금', '토'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="month-cells">
        {Array.from({ length: offset }, (_, index) => <div className="month-blank" key={`before-${index}`} />)}
        {days.map(day => <button
          key={day.date} type="button" data-date={day.date}
          className={`month-day ${selected === day.date ? 'is-selected' : ''} ${currentDay === day.date ? 'is-current' : ''}`}
          aria-pressed={selected === day.date} aria-current={currentDay === day.date ? 'date' : undefined}
          aria-controls="calendar-day-detail"
          aria-label={`${dateLabel(day.date)}, 예약 ${day.appointments.length}건, 수입 ${money(day.income)}원, 지출 ${money(day.spending)}원`}
          onClick={() => onSelect(day.date)}
        >
          <span className="month-day-heading"><span className="month-day-number">{Number(day.date.slice(8))}</span>{day.date === currentDay && <span className="month-today">오늘</span>}</span>
          {day.appointments.length > 0 && <span className="month-day-bookings"><span className="month-booking-count">예약 {day.appointments.length}건</span>{showBookings && <span className="month-booking-preview">{day.appointments.slice(0, 2).map(appointment => <span key={appointment.id}><time>{appointment.time}</time> {appointment.dogName}</span>)}{day.appointments.length > 2 && <span>+{day.appointments.length - 2}건 더</span>}</span>}</span>}
          {(day.payments.length > 0 || day.expenses.length > 0) && <span className="month-day-money">{day.payments.length > 0 && <span className="calendar-income">+{money(day.income)}</span>}{day.expenses.length > 0 && <span className="calendar-spending">−{money(day.spending)}</span>}</span>}
        </button>)}
        {Array.from({ length: padding }, (_, index) => <div className="month-blank" key={`after-${index}`} />)}
      </div>
      <div className="month-calendar-note"><span>날짜를 누르면 아래에서 상세 내역을 볼 수 있어요.</span><span><i className="income-dot" />수입 <i className="spending-dot" />지출 · 원 단위 / 실제 결제일 기준</span></div>
    </section>

    <section className="panel calendar-day-detail" id="calendar-day-detail" aria-label="선택한 날짜의 상세 내역">
      <div className="selected-day-heading"><div><span className="section-eyebrow">선택한 하루</span><h2><CalendarDays size={20} />{dateLabel(selected)}{selected === currentDay && <span className="soft-tag">오늘</span>}</h2></div><div className="selected-day-actions">{showBookings && <button className="btn btn-primary btn-small" onClick={props.onAdd}><Plus size={15} />이날 예약 등록</button>}<button className="btn btn-secondary btn-small" disabled={selected > currentDay} title={selected > currentDay ? '지출은 오늘까지의 날짜로 기록할 수 있어요.' : undefined} onClick={props.onExpense}><Plus size={15} />이날 지출 기록</button></div></div>
      <div className="selected-day-totals" aria-live="polite"><span>수입 <strong className="calendar-income">+{money(selectedDay.income)}원</strong></span><span>지출 <strong className="calendar-spending">−{money(selectedDay.spending)}원</strong></span><span>차액 <strong>{money(selectedDay.income - selectedDay.spending)}원</strong></span></div>
      <div className={`selected-day-columns ${showBookings ? 'has-both' : ''}`}>
        {showBookings && <section className="selected-bookings"><h3><Clock3 size={16} />예약 <span>{selectedDay.appointments.length}건</span></h3>{selectedDay.appointments.length ? <div className="calendar-records">{selectedDay.appointments.map(appointment => <article className="calendar-booking-record" key={appointment.id}>
          <div className="calendar-record-main"><time>{appointment.time}</time><div><button className="pet-name" onClick={() => props.onDetails(appointment)}>{appointment.dogName}</button><p>{appointment.service} · {appointment.duration}분</p><p>{appointment.guardianName}{appointment.breed ? ` · ${appointment.breed}` : ''}</p></div><strong>{money(appointment.price)}원</strong></div>
          <div className="calendar-record-actions">{appointment.paymentStatus === 'paid' ? <span className="badge paid"><Check size={12} />정산 완료</span> : <><button className="btn btn-soft btn-small" onClick={() => props.onSettle(appointment)}>정산하기</button><button className="icon-button" aria-label={`${appointment.dogName} 예약 수정`} onClick={() => props.onEdit(appointment)}><Settings2 size={15} /></button><button className="icon-button subtle-danger" aria-label={`${appointment.dogName} 예약 취소`} onClick={() => props.onCancel(appointment)}><X size={15} /></button></>}</div>
        </article>)}</div> : <p className="calendar-no-records">이날은 등록된 예약이 없어요.</p>}</section>}
        <section className="selected-transactions"><h3>수입 · 지출 <span>{selectedDay.payments.length + selectedDay.expenses.length}건</span></h3>{selectedDay.payments.length + selectedDay.expenses.length ? <div className="calendar-records">
          {selectedDay.payments.map(appointment => <article className="calendar-transaction" key={appointment.id}><span className="transaction-kind is-income">수입</span><div><button className="pet-name" onClick={() => props.onDetails(appointment)}>{appointment.dogName} · {appointment.service}</button><p>{paymentLabels[appointment.paymentMethod!]}{appointment.date !== selected ? ` · 예약일 ${appointment.date}` : ''}</p></div><strong className="calendar-income">+{money(appointment.price)}원</strong></article>)}
          {selectedDay.expenses.map(expense => <article className="calendar-transaction" key={expense.id}><span className="transaction-kind is-spending">지출</span><div><strong className="transaction-description">{expense.memo || expense.category}</strong><p>{expense.category}</p></div><strong className="calendar-spending">−{money(expense.amount)}원</strong><button className="icon-button subtle-danger" aria-label={`${expense.memo || expense.category} 지출 삭제`} onClick={() => props.onDeleteExpense(expense.id)}><Trash2 size={15} /></button></article>)}
        </div> : <p className="calendar-no-records">이날은 수입·지출 기록이 없어요. 예약을 정산하면 실제 결제일에 수입으로 표시돼요.</p>}</section>
      </div>
    </section>
  </div>;
}
