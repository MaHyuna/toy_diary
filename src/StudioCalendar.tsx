import { Check, Plus, Settings2, X } from 'lucide-react';
import { monthDays } from './calendar';
import type { Appointment } from './types';
import { money, paymentLabels, today } from './types';
import { Modal } from './Forms';

type Props = {
  selected: string;
  appointments: Appointment[];
  detailsOpen: boolean;
  onCloseDetails: () => void;
  onSelect: (date: string) => void;
  onAdd: () => void;
  onDetails: (appointment: Appointment) => void;
  onSettle: (appointment: Appointment) => void;
  onEdit: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
};

const compactMoney = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 });

const dateLabel = (date: string) => new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'UTC', month: 'long', day: 'numeric', weekday: 'long',
}).format(new Date(`${date}T12:00:00Z`));

export function StudioCalendar(props: Props) {
  const { selected, appointments, onSelect } = props;
  const month = selected.slice(0, 7);
  const days = monthDays(month, appointments, []);
  const selectedDay = days.find(day => day.date === selected)!;
  const offset = new Date(`${month}-01T12:00:00Z`).getUTCDay();
  const padding = (7 - (offset + days.length) % 7) % 7;
  const completed = days.reduce((sum, day) => sum + day.completedCount, 0);
  const bookingCount = days.reduce((sum, day) => sum + day.appointments.length, 0);
  const currentDay = today();

  return <div className="studio-calendar grooming-calendar">
    <section className="panel month-calendar" aria-label="월간 예약 캘린더">
      <div className="month-weekdays" aria-hidden="true">{['일', '월', '화', '수', '목', '금', '토'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="month-cells" data-weeks={(offset + days.length + padding) / 7}>
        {Array.from({ length: offset }, (_, index) => <div className="month-blank" key={`before-${index}`} />)}
        {days.map(day => <button
          key={day.date} type="button" data-date={day.date}
          className={`month-day ${selected === day.date ? 'is-selected' : ''} ${currentDay === day.date ? 'is-current' : ''}`}
          aria-pressed={selected === day.date} aria-current={currentDay === day.date ? 'date' : undefined}
          aria-haspopup="dialog"
          aria-label={`${dateLabel(day.date)}, 예약 ${day.appointments.length}건, 예약 금액 ${money(day.bookingAmount)}원, 미용 완료 ${day.completedCount}건`}
          onClick={() => onSelect(day.date)}
        >
          <span className="month-day-heading"><span className="month-day-number">{Number(day.date.slice(8))}</span></span>
          {day.appointments.length > 0 && <>
            <span className="month-day-bookings"><span className={`month-booking-count ${day.completedCount === day.appointments.length ? 'all-complete' : ''}`}>{day.appointments.length}건</span></span>
            <span className="month-quote" title={`${money(day.bookingAmount)}원`}>{day.bookingAmount >= 1_000_000 ? compactMoney.format(day.bookingAmount) : money(day.bookingAmount)}</span>
          </>}
        </button>)}
        {Array.from({ length: padding }, (_, index) => <div className="month-blank" key={`after-${index}`} />)}
      </div>
      <div className="grooming-calendar-caption"><span>예약 <strong>{bookingCount}건</strong> · 미용 완료 <strong>{completed}건</strong></span><span>예약 금액 · 원</span></div>
    </section>

    {props.detailsOpen && <Modal title={dateLabel(selected)} description={`예약 ${selectedDay.appointments.length}건 · 미용 완료 ${selectedDay.completedCount}건`} onClose={props.onCloseDetails} className="grooming-day-sheet">
      <section className="grooming-day" aria-label="선택한 날의 미용 예약">
        <div className="grooming-day-total"><span>예약 금액</span><strong>{money(selectedDay.bookingAmount)}원</strong><button className="btn btn-soft btn-small" onClick={props.onAdd}><Plus size={16} />예약 추가</button></div>
        {selectedDay.appointments.length ? <div className="grooming-visits">{selectedDay.appointments.map(appointment => <article className={`grooming-visit ${appointment.status === 'completed' ? 'is-complete' : ''}`} key={appointment.id}>
          <time>{appointment.time}</time>
          <div className="grooming-visit-info"><button className="pet-name" onClick={() => props.onDetails(appointment)}>{appointment.dogName}</button><p>{appointment.service}{appointment.weight ? ` · ${appointment.weight}kg` : ''}</p><small>{appointment.guardianName} · {appointment.duration}분</small></div>
          <div className="grooming-visit-result"><strong>{money(appointment.price)}원</strong>{appointment.paymentStatus === 'paid' ? <span className="grooming-done"><Check size={12} />완료 · {paymentLabels[appointment.paymentMethod!]}</span> : <button className="btn btn-primary btn-small" onClick={() => props.onSettle(appointment)}>미용 완료</button>}</div>
          {appointment.paymentStatus === 'unpaid' && <div className="grooming-visit-tools"><button className="text-button" onClick={() => props.onEdit(appointment)} aria-label={`${appointment.dogName} 예약·요금 수정`}><Settings2 size={13} />예약·요금 수정</button><button className="text-button" onClick={() => props.onCancel(appointment)} aria-label={`${appointment.dogName} 예약 취소`}><X size={13} />취소</button></div>}
        </article>)}</div> : <div className="grooming-empty"><p>아직 예약이 없어요.</p><button className="btn btn-primary" onClick={props.onAdd}><Plus size={17} />이날 예약 잡기</button></div>}
      </section>
    </Modal>}
  </div>;
}
