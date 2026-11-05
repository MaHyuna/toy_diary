import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, LoaderCircle, Pencil, Phone, ReceiptText } from 'lucide-react';
import { PetAvatar } from './PetAvatar';
import type { Appointment, CareRecordSummary, Customer, GroomingRecord, Pet, PetPhoto } from './types';
import { money, paymentLabels } from './types';
import { VisitReport } from './ShareCard';
import { Modal } from './Forms';

type Props = {
  appointment: Appointment;
  pet?: Pet;
  customer?: Customer;
  photos?: PetPhoto[];
  onSaveNotes?: (notes: string) => Promise<void>;
  careRecord?: GroomingRecord;
  careSummary?: CareRecordSummary;
  onCare?: () => void;
  onClose: () => void;
  onEdit: () => void;
  onSettle: () => void;
};

export function AppointmentDetails({ appointment: a, pet, customer, photos, careRecord, careSummary, onCare, onSaveNotes, onClose, onEdit, onSettle }: Props) {
  const editable = a.status !== 'cancelled' && a.paymentStatus === 'unpaid';
  // Notes have a dedicated text-only update path; financial history stays locked.
  const notesEditable = !!onSaveNotes;
  const [draft, setDraft] = useState(a.notes);
  const [savedNotes, setSavedNotes] = useState(a.notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const savedRef = useRef(a.notes);
  const appointmentRef = useRef(a.id);
  const saving = useRef(false);
  const noteId = useId();
  const dirty = draft !== savedNotes;
  const visitPhotos = photos ?? pet?.photos;
  const linkedPet = pet ? { ...pet, photos: visitPhotos } : { id: a.petId || '', name: a.dogName, breed: a.breed, photos: visitPhotos };
  const phone = a.phone || customer?.phone || '';
  const currentPhone = customer?.phone && a.phone && customer.phone !== a.phone ? customer.phone : '';
  const careNotes = [
    { title: '미용 요청 · 선호 스타일', text: pet?.preferredStyle, caution: false },
    { title: '알레르기', text: pet?.allergies, caution: true },
    { title: '피부 · 건강 참고', text: pet?.healthNotes, caution: true },
    { title: '행동 주의', text: pet?.behaviorNotes, caution: true },
    { title: '보호자 메모', text: customer?.notes, caution: false },
  ].filter(note => note.text?.trim());

  useEffect(() => {
    if (appointmentRef.current !== a.id) {
      appointmentRef.current = a.id;
      setDraft(a.notes);
      setSaved(false);
      setError('');
    } else {
      // A background refresh must not discard text the operator is still writing.
      setDraft(current => current === savedRef.current ? a.notes : current);
    }
    savedRef.current = a.notes;
    setSavedNotes(a.notes);
  }, [a.id, a.notes]);

  async function saveNotes() {
    if (!onSaveNotes || !notesEditable || !dirty || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    setSaved(false);
    const submitted = draft;
    try {
      await onSaveNotes(submitted);
      const normalized = submitted.trim();
      savedRef.current = normalized;
      setSavedNotes(normalized);
      setDraft(normalized);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '메모를 저장하지 못했어요. 입력 내용은 유지됩니다.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <Modal title={`${a.dogName}의 예약`} description={`${a.date} · ${a.time} · ${a.duration}분`} onClose={onClose} busy={busy} className="appointment-details">
    <div className="modal-body">
      <div className="detail-summary"><PetAvatar pet={linkedPet} /><div><strong>{a.dogName}</strong><p>{a.breed || '견종 미입력'}{a.weight ? ` · ${a.weight}kg` : ''}</p></div><span className={`badge ${a.status === 'cancelled' ? 'cancelled' : a.paymentStatus === 'paid' ? 'paid' : 'scheduled'}`}>{a.status === 'cancelled' ? '예약 취소' : a.paymentStatus === 'paid' ? '결제 완료' : '예약 확정'}</span></div>
      {onCare && <section className="care-visit-entry"><div><h3>미용 전·후 · 케어 기록</h3><p>{careRecord || careSummary ? `${careRecord?.photos.length ?? careSummary?.photoCount ?? 0}장 · ${(careRecord ?? careSummary)?.published ? '보호자 공개 중' : '작성 중'}` : '사진과 소견, 집에서 관리할 내용을 남겨요.'}</p></div><button type="button" className="btn btn-secondary btn-small" disabled={busy || dirty} title={dirty ? '미용 메모를 먼저 저장해 주세요.' : '이 방문의 전후 기록 열기'} onClick={onCare}>{careRecord || careSummary ? '기록 보기' : '기록하기'}</button></section>}
      <dl className="detail-info">
        <div><dt><Phone size={14} />보호자</dt><dd>{a.guardianName || customer?.name || '미입력'}{phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>}{currentPhone && <small>현재 고객대장 연락처 <a href={`tel:${currentPhone.replace(/[^\d+]/g, '')}`}>{currentPhone}</a></small>}</dd></div>
        <div><dt><CalendarDays size={14} />서비스</dt><dd>{a.service} · {a.duration}분</dd></div>
        {a.paymentStatus === 'paid' && <div><dt><ReceiptText size={14} />결제 기록</dt><dd>{a.paidDate} · {paymentLabels[a.paymentMethod!]}</dd></div>}
      </dl>

      {careNotes.length > 0 && <section className="detail-care-section" aria-label="아이와 보호자 참고사항"><h3 className="detail-care-heading">현재 고객대장 참고사항</h3><div className="detail-care-grid">
        {careNotes.map(note => <article key={note.title} className={`detail-care-note ${note.caution ? 'is-caution' : ''}`}>
          <h3>{note.caution && <AlertTriangle size={14} />}{note.title}</h3><p>{note.text}</p>
        </article>)}
      </div></section>}
      {!pet && <p className="field-hint">고객대장에 연결되지 않은 방문입니다. 아래에 이번 미용의 요청과 주의사항을 남겨 주세요.</p>}

      <section className="appointment-note-editor" aria-label="미용 메모 편집">
        <header><h3><label htmlFor={noteId}>미용 메모</label></h3>{dirty && <span className="note-dirty">저장 전 변경사항</span>}</header>
        <p className="field-hint">매장용 메모예요. 보호자 케어 기록에는 포함되지 않아요.</p>
        {notesEditable ? <>
          <textarea id={noteId} value={draft} maxLength={2000} rows={4} disabled={busy} placeholder="오늘의 미용 요청, 진행 내용과 다음 방문 때 참고할 내용을 적어 주세요." onChange={event => { setDraft(event.target.value); setSaved(false); }} />
          <div className="note-editor-actions"><span role="status">{saved && !dirty ? '메모를 저장했어요.' : `${draft.length}/2,000자`}</span><button type="button" className="btn btn-secondary btn-small" disabled={busy || !dirty} onClick={() => void saveNotes()}>{busy ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}{busy ? '저장 중…' : '메모 저장'}</button></div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </> : <><p className="saved-grooming-note">{savedNotes || '등록된 메모가 없어요.'}</p></>}
      </section>

      <details className="detail-price-disclosure"><summary><span>요금 상세</span><strong>{money(a.price)}원</strong></summary>
        <div className="quote-breakdown"><div><span>서비스 기본요금</span><strong>{money(a.basePrice)}원</strong></div>{a.breedSurcharge > 0 && <div><span>견종 추가요금</span><strong>{money(a.breedSurcharge)}원</strong></div>}{a.weightSurcharge > 0 && <div><span>몸무게 추가요금</span><strong>{money(a.weightSurcharge)}원</strong></div>}{a.extraCharges.map((charge, index) => <div key={index}><span>{charge.label}</span><strong>{money(charge.amount)}원</strong></div>)}{a.shampooSurcharge > 0 && <div><span>샴푸 추가요금</span><strong>{money(a.shampooSurcharge)}원</strong></div>}<div className="quote-sum"><span>총금액</span><strong>{money(a.price)}원</strong></div></div>
        {!!a.shampooUsage?.length && <div className="detail-shampoo"><h3>사용한 샴푸</h3>{a.shampooUsage.map(usage => <div key={usage.shampooId}><div><strong>{usage.name}</strong><p>원액 {usage.usedMl}mL · 당시 사용 원가 {money(usage.cost)}원</p></div><span>고객 추가요금 {money(usage.customerCharge)}원</span></div>)}<p className="field-hint">고객 추가요금은 총금액에 포함돼요. 사용 원가는 구매 지출과 별개로 확인하는 참고 값이에요.</p></div>}
        <VisitReport appointment={{ ...a, notes: savedNotes }} photos={visitPhotos} label="방문 금액 안내 이미지" />
      </details>
    </div>
    <footer className="modal-footer"><button className="btn btn-secondary" onClick={onClose} disabled={busy}>닫기</button>{editable && <><button className="btn btn-secondary" onClick={onEdit} disabled={busy}><Pencil size={14} />예약·요금 수정</button><button className="btn btn-primary" onClick={onSettle} disabled={busy}>미용 완료</button></>}</footer>
  </Modal>;
}
