import { CalendarDays, Dog, Pencil, Phone, ReceiptText } from 'lucide-react';
import type { Appointment } from './types';
import { money, paymentLabels } from './types';
import { Modal } from './Forms';

export function AppointmentDetails({ appointment: a, onClose, onEdit, onSettle }: {
  appointment: Appointment;
  onClose: () => void;
  onEdit: () => void;
  onSettle: () => void;
}) {
  const editable = a.status !== 'cancelled' && a.paymentStatus === 'unpaid';
  return <Modal title={`${a.dogName}의 예약`} description={`${a.date} · ${a.time} · ${a.duration}분`} onClose={onClose}>
    <div className="modal-body">
      <div className="detail-summary"><div className="pet-avatar"><Dog size={28} /></div><div><strong>{a.dogName}</strong><p>{a.breed || '견종 미입력'}{a.weight ? ` · ${a.weight}kg` : ''}</p></div><span className={`badge ${a.status === 'cancelled' ? 'cancelled' : a.paymentStatus === 'paid' ? 'paid' : 'scheduled'}`}>{a.status === 'cancelled' ? '예약 취소' : a.paymentStatus === 'paid' ? '미용 완료' : '예약 확정'}</span></div>
      <dl className="detail-info"><div><dt><Phone size={14} />보호자</dt><dd>{a.guardianName}{a.phone && <a href={`tel:${a.phone.replace(/[^\d+]/g, '')}`}>{a.phone}</a>}</dd></div><div><dt><CalendarDays size={14} />서비스</dt><dd>{a.service}</dd></div>{a.paymentStatus === 'paid' && <div><dt><ReceiptText size={14} />정산</dt><dd>{a.paidDate} · {paymentLabels[a.paymentMethod!]}</dd></div>}</dl>
      <div className="quote-breakdown"><h3>요금 상세</h3><div><span>서비스 기본요금</span><strong>{money(a.basePrice)}원</strong></div>{a.breedSurcharge > 0 && <div><span>견종 추가요금</span><strong>{money(a.breedSurcharge)}원</strong></div>}{a.weightSurcharge > 0 && <div><span>몸무게 추가요금</span><strong>{money(a.weightSurcharge)}원</strong></div>}{a.extraCharges.map((charge, index) => <div key={index}><span>{charge.label}</span><strong>{money(charge.amount)}원</strong></div>)}{a.shampooSurcharge > 0 && <div><span>샴푸 추가요금</span><strong>{money(a.shampooSurcharge)}원</strong></div>}<div className="quote-sum"><span>총금액</span><strong>{money(a.price)}원</strong></div></div>
      {!!a.shampooUsage?.length && <div className="detail-shampoo"><h3>사용한 샴푸</h3>{a.shampooUsage.map(usage => <div key={usage.shampooId}><div><strong>{usage.name}</strong><p>원액 {usage.usedMl}mL · 당시 사용 원가 {money(usage.cost)}원</p></div><span>고객 추가요금 {money(usage.customerCharge)}원</span></div>)}<p className="field-hint">샴푸 고객 추가요금 {money(a.shampooSurcharge)}원은 위 총금액에 포함돼요. 사용 원가는 구매 지출과 별개로 확인하는 참고 값이에요.</p></div>}
      <div className="detail-notes"><h3>미용 메모</h3><p>{a.notes || '등록된 메모가 없어요.'}</p></div>
    </div>
    <footer className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>닫기</button>{editable && <><button className="btn btn-secondary" onClick={onEdit}><Pencil size={14} />예약·요금 수정</button><button className="btn btn-primary" onClick={onSettle}>미용 완료</button></>}</footer>
  </Modal>;
}
