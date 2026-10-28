import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, CalendarDays, Check, Dog, Heart, Link, LoaderCircle, PawPrint, Pencil, Plus, Search, ShieldAlert, UserRound, Users, X } from 'lucide-react';
import { Modal } from './Forms';
import { api, money, today } from './types';
import type { Appointment, Customer, Pet } from './types';

type Callbacks = { onClose: () => void; onSaved: () => void };
type PetDraft = { name: string; customerId: string; breed: string; weight: string; birthDate: string; sex: 'unknown' | 'male' | 'female'; neutered: string; allergies: string; healthNotes: string; behaviorNotes: string; preferredStyle: string; visitIntervalWeeks: string };
type Dialog = { type: 'register'; customerId?: string } | { type: 'customer'; customer?: Customer } | { type: 'pet'; pet: Pet } | { type: 'detail'; pet: Pet } | null;
const displayDate = (date: string) => `${Number(date.slice(0, 4))}.${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
const shortDate = (date: string) => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
const sexLabels = { unknown: '성별 미등록', male: '수컷', female: '암컷' };

function newPet(initial?: Pet, customerId = ''): PetDraft {
  return { name: initial?.name ?? '', customerId: initial?.customerId ?? customerId, breed: initial?.breed ?? '', weight: initial?.weight?.toString() ?? '', birthDate: initial?.birthDate ?? '', sex: initial?.sex ?? 'unknown', neutered: initial?.neutered === null || initial?.neutered === undefined ? 'unknown' : initial.neutered ? 'yes' : 'no', allergies: initial?.allergies ?? '', healthNotes: initial?.healthNotes ?? '', behaviorNotes: initial?.behaviorNotes ?? '', preferredStyle: initial?.preferredStyle ?? '', visitIntervalWeeks: initial?.visitIntervalWeeks?.toString() ?? '' };
}

function useSave() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  async function run(operation: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했어요. 입력 내용을 확인해 주세요.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return { busy, error, run };
}

function SaveButton({ busy, label }: { busy: boolean; label: string }) {
  return <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}{busy ? '저장 중…' : label}</button>;
}

function CustomerForm({ initial, onClose, onSaved }: Callbacks & { initial?: Customer }) {
  const id = useId();
  const [values, setValues] = useState({ name: initial?.name ?? '', phone: initial?.phone ?? '', notes: initial?.notes ?? '' });
  const { busy, error, run } = useSave();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => { await api(initial ? `/customers/${initial.id}` : '/customers', initial ? 'PATCH' : 'POST', { ...values, name: values.name.trim(), phone: values.phone.trim() }); onSaved(); });
  }
  return <Modal title={initial ? '보호자 정보 수정' : '보호자 등록'} description="동명이인도 구분할 수 있도록 연락처를 함께 남겨주세요." onClose={onClose} busy={busy}>
    <form onSubmit={submit}><div className="modal-body"><div className="form-grid">
      <div className="field"><label htmlFor={`${id}-name`}>보호자 이름</label><input id={`${id}-name`} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} maxLength={80} required disabled={busy} data-autofocus /></div>
      <div className="field"><label htmlFor={`${id}-phone`}>보호자 연락처</label><input id={`${id}-phone`} type="tel" value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} maxLength={40} disabled={busy} placeholder="010-0000-0000" /></div>
      <div className="field field-full"><label htmlFor={`${id}-notes`}>보호자 메모</label><textarea id={`${id}-notes`} rows={3} value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} maxLength={2000} disabled={busy} placeholder="선호 연락 시간, 안내할 내용 등을 기록해요." /></div>
    </div>{error && <p className="form-error" role="alert">{error}</p>}</div><footer className="modal-footer"><button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>취소</button><SaveButton busy={busy} label={initial ? '보호자 정보 저장' : '보호자 저장'} /></footer></form>
  </Modal>;
}

function PetFields({ values, setValues, busy, id }: { values: PetDraft; setValues: (values: PetDraft) => void; busy: boolean; id: string }) {
  const update = (key: keyof PetDraft, value: string) => setValues({ ...values, [key]: value });
  return <div className="form-grid">
    <div className="field"><label htmlFor={`${id}-name`}>반려견 이름</label><input id={`${id}-name`} value={values.name} onChange={(e) => update('name', e.target.value)} maxLength={80} required disabled={busy} placeholder="예: 몽이" /></div>
    <div className="field"><label htmlFor={`${id}-breed`}>견종</label><input id={`${id}-breed`} value={values.breed} onChange={(e) => update('breed', e.target.value)} maxLength={80} disabled={busy} placeholder="예: 비숑 프리제" /></div>
    <div className="field"><label htmlFor={`${id}-weight`}>몸무게 (kg)</label><input id={`${id}-weight`} type="number" min="0.1" max="150" step="0.1" value={values.weight} onChange={(e) => update('weight', e.target.value)} disabled={busy} placeholder="예: 4.5" /></div>
    <div className="field"><label htmlFor={`${id}-birthday`}>생일</label><input id={`${id}-birthday`} type="date" max={today()} value={values.birthDate} onChange={(e) => update('birthDate', e.target.value)} disabled={busy} /></div>
    <div className="field"><label htmlFor={`${id}-sex`}>성별</label><select id={`${id}-sex`} value={values.sex} onChange={(e) => update('sex', e.target.value)} disabled={busy}><option value="unknown">아직 모름</option><option value="male">수컷</option><option value="female">암컷</option></select></div>
    <div className="field"><label htmlFor={`${id}-neutered`}>중성화 여부</label><select id={`${id}-neutered`} value={values.neutered} onChange={(e) => update('neutered', e.target.value)} disabled={busy}><option value="unknown">아직 모름</option><option value="yes">완료</option><option value="no">하지 않음</option></select></div>
    <div className="field field-full"><label htmlFor={`${id}-interval`}>권장 미용 주기 (주)</label><input id={`${id}-interval`} type="number" min="1" max="104" step="1" value={values.visitIntervalWeeks} onChange={(e) => update('visitIntervalWeeks', e.target.value)} disabled={busy} placeholder="예: 6" /><p className="field-hint">최근 미용일을 기준으로 다음 권장 방문일을 계산해요.</p></div>
    <div className="field field-full"><label htmlFor={`${id}-allergies`}>알레르기</label><textarea id={`${id}-allergies`} rows={2} value={values.allergies} onChange={(e) => update('allergies', e.target.value)} maxLength={2000} disabled={busy} placeholder="피해야 할 샴푸 성분, 음식 등을 기록해요." /></div>
    <div className="field field-full"><label htmlFor={`${id}-health`}>피부 · 건강 참고사항</label><textarea id={`${id}-health`} rows={2} value={values.healthNotes} onChange={(e) => update('healthNotes', e.target.value)} maxLength={2000} disabled={busy} placeholder="예: 오른쪽 귀 염증, 뒷다리 관절 주의" /></div>
    <div className="field field-full"><label htmlFor={`${id}-behavior`}>입질 · 행동 특성</label><textarea id={`${id}-behavior`} rows={2} value={values.behaviorNotes} onChange={(e) => update('behaviorNotes', e.target.value)} maxLength={2000} disabled={busy} placeholder="예: 발 만질 때 예민함, 드라이 소리에 놀람" /></div>
    <div className="field field-full"><label htmlFor={`${id}-style`}>선호 스타일</label><textarea id={`${id}-style`} rows={2} value={values.preferredStyle} onChange={(e) => update('preferredStyle', e.target.value)} maxLength={2000} disabled={busy} placeholder="예: 얼굴은 동그랗게, 귀는 짧게" /></div>
  </div>;
}

function PetForm({ customers, initial, customerId, onSaved, onClose }: Callbacks & { customers: Customer[]; initial?: Pet; customerId?: string }) {
  const id = useId();
  const [mode, setMode] = useState<'new' | 'existing'>(initial || customerId ? 'existing' : 'new');
  const [guardian, setGuardian] = useState({ name: '', phone: '', notes: '' });
  const [values, setValues] = useState<PetDraft>(() => newPet(initial, customerId || customers[0]?.id));
  const [createdCustomer, setCreatedCustomer] = useState<Customer | null>(null);
  const createdCustomerRef = useRef<Customer | null>(null);
  const { busy, error, run } = useSave();
  const close = () => { if (createdCustomerRef.current) onSaved(); else onClose(); };
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      let ownerId = values.customerId;
      if (mode === 'new') {
        let owner = createdCustomerRef.current;
        if (!owner) {
          owner = await api<Customer>('/customers', 'POST', { ...guardian, name: guardian.name.trim(), phone: guardian.phone.trim() });
          createdCustomerRef.current = owner; setCreatedCustomer(owner);
        }
        ownerId = owner.id;
      }
      await api(initial ? `/pets/${initial.id}` : '/pets', initial ? 'PATCH' : 'POST', { ...values, customerId: ownerId, name: values.name.trim(), breed: values.breed.trim(), weight: values.weight ? Number(values.weight) : null, neutered: values.neutered === 'unknown' ? null : values.neutered === 'yes', visitIntervalWeeks: values.visitIntervalWeeks ? Number(values.visitIntervalWeeks) : null });
      onSaved();
    });
  }
  return <Modal title={initial ? '반려견 정보 수정' : '고객 · 반려견 등록'} description="한 보호자에게 여러 반려견을 연결하고, 아이마다 미용 기록을 쌓아요." onClose={close} busy={busy}>
    <form onSubmit={submit}><div className="modal-body">
      {!initial && <div className="segmented customer-owner-toggle" role="group" aria-label="보호자 선택 방식"><button type="button" className={mode === 'new' ? 'active' : ''} aria-pressed={mode === 'new'} disabled={busy || !!createdCustomer} onClick={() => setMode('new')}><UserRound size={17} />새 보호자</button><button type="button" className={mode === 'existing' ? 'active' : ''} aria-pressed={mode === 'existing'} disabled={busy || !!createdCustomer || customers.length === 0} onClick={() => setMode('existing')}><Users size={17} />기존 보호자</button></div>}
      <section className="customer-form-section"><h3><UserRound size={16} /> 보호자 정보</h3>
        {mode === 'new' ? <div className="form-grid"><div className="field"><label htmlFor={`${id}-guardian`}>보호자 이름</label><input id={`${id}-guardian`} value={guardian.name} onChange={(e) => setGuardian({ ...guardian, name: e.target.value })} required maxLength={80} disabled={busy || !!createdCustomer} data-autofocus /></div><div className="field"><label htmlFor={`${id}-phone`}>보호자 연락처</label><input id={`${id}-phone`} type="tel" value={guardian.phone} onChange={(e) => setGuardian({ ...guardian, phone: e.target.value })} maxLength={40} disabled={busy || !!createdCustomer} placeholder="010-0000-0000" /></div><div className="field field-full"><label htmlFor={`${id}-guardian-notes`}>보호자 메모</label><textarea id={`${id}-guardian-notes`} rows={2} value={guardian.notes} onChange={(e) => setGuardian({ ...guardian, notes: e.target.value })} maxLength={2000} disabled={busy || !!createdCustomer} /></div><p className="field-hint field-full">이름이나 연락처가 같아도 기존 보호자와 자동으로 합치지 않아요. 재방문 고객은 ‘기존 보호자’를 선택해 주세요.</p></div> : <div className="field"><label htmlFor={`${id}-owner`}>연결할 보호자</label><select id={`${id}-owner`} value={values.customerId} onChange={(e) => setValues({ ...values, customerId: e.target.value })} required disabled={busy} data-autofocus><option value="">보호자를 선택해 주세요</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone || '연락처 미등록'}</option>)}</select>{initial && <p className="field-hint">예약 이력이 연결된 아이는 보호자를 바꿀 수 없어요. 보호자 이름과 연락처는 보호자 정보에서 수정하세요.</p>}</div>}
      </section>
      {createdCustomer && error && <p className="customer-save-notice" role="status">보호자 정보는 저장됐어요. 반려견 정보를 확인하고 다시 저장해 주세요. 보호자는 중복으로 등록하지 않아요.</p>}
      <section className="customer-form-section"><h3><PawPrint size={16} /> 반려견 정보</h3><PetFields id={id} values={values} setValues={setValues} busy={busy} /></section>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div><footer className="modal-footer"><button type="button" className="btn btn-secondary" disabled={busy} onClick={close}>취소</button><SaveButton busy={busy} label={initial ? '반려견 정보 저장' : '고객 정보 저장'} /></footer></form>
  </Modal>;
}

function visitInfo(pet: Pet, appointments: Appointment[]) {
  const history = appointments.filter((appointment) => appointment.petId === pet.id).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const nowTime = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const visited = history.filter((appointment) => appointment.paymentStatus === 'paid' && appointment.status !== 'cancelled' && appointment.date <= today());
  const next = history.filter((appointment) => appointment.status !== 'cancelled' && `${appointment.date}${appointment.time}` >= `${today()}${nowTime}`).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];
  const latest = visited[0];
  let recommended = '';
  if (latest && pet.visitIntervalWeeks) {
    const date = new Date(`${latest.date}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + pet.visitIntervalWeeks * 7); recommended = date.toISOString().slice(0, 10);
  }
  return { history, latest, next, recommended, visited, paidTotal: history.filter((appointment) => appointment.paymentStatus === 'paid' && appointment.status !== 'cancelled').reduce((sum, appointment) => sum + appointment.price, 0) };
}

function PetDetail({ pet, customer, appointments, onEdit, onBook, onSaved, onClose }: Callbacks & { pet: Pet; customer?: Customer; appointments: Appointment[]; onEdit: () => void; onBook: () => void }) {
  const id = useId();
  const { history, latest, next, recommended, visited, paidTotal } = visitInfo(pet, appointments);
  const unlinked = appointments.filter((appointment) => !appointment.petId).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const [linkId, setLinkId] = useState('');
  const { busy, error, run } = useSave();
  const notes = [{ title: '알레르기', value: pet.allergies, warning: true }, { title: '피부 · 건강 참고사항', value: pet.healthNotes, warning: true }, { title: '입질 · 행동 특성', value: pet.behaviorNotes, warning: true }, { title: '선호 스타일', value: pet.preferredStyle, warning: false }];
  return <Modal title={`${pet.name}의 고객 장부`} description={`${customer?.name || '보호자'} 보호자 · ${customer?.phone || '연락처 미등록'}`} onClose={onClose} busy={busy}>
    <div className="modal-body customer-detail">
      <div className="customer-pet-profile"><div className="pet-avatar"><Dog size={31} /></div><div><h3>{pet.name}</h3><p>{[pet.breed || '견종 미등록', pet.weight ? `${pet.weight}kg` : '몸무게 미등록', sexLabels[pet.sex]].join(' · ')}</p></div></div>
      <dl className="customer-pet-facts"><div><dt>생일</dt><dd>{pet.birthDate ? displayDate(pet.birthDate) : '미등록'}</dd></div><div><dt>중성화</dt><dd>{pet.neutered === null ? '미등록' : pet.neutered ? '완료' : '하지 않음'}</dd></div><div><dt>미용 주기</dt><dd>{pet.visitIntervalWeeks ? `${pet.visitIntervalWeeks}주` : '미등록'}</dd></div></dl>
      <div className="customer-visit-stats"><div><span>최근 미용</span><strong>{latest ? shortDate(latest.date) : '아직 없음'}</strong><small>{visited.length}회 방문 완료</small></div><div><span>다음 예약</span><strong>{next ? shortDate(next.date) : '예약 없음'}</strong><small>{next ? `${next.time} · ${next.service}` : recommended ? `권장 방문 ${displayDate(recommended)}` : '다음 만남을 예약해 주세요'}</small></div><div><span>누적 정산 금액</span><strong>{money(paidTotal)}<small>원</small></strong><small>정산 완료 내역 기준</small></div></div>
      <div className="customer-pet-notes">{notes.map((note) => <section className={note.value && note.warning ? 'has-note' : ''} key={note.title}><h4>{note.warning ? <ShieldAlert size={15} /> : <Heart size={15} />}{note.title}</h4><p>{note.value || '아직 기록된 내용이 없어요.'}</p></section>)}</div>
      <section className="customer-history"><h3><CalendarDays size={17} /> 예약 · 미용 이력 <span className="count-pill">{history.length}</span></h3>{history.length ? <div className="customer-history-list">{history.map((appointment) => <article key={appointment.id} className={appointment.status === 'cancelled' ? 'is-cancelled' : ''}><div><strong>{displayDate(appointment.date)} <span>{appointment.time}</span></strong><p>{appointment.service} · {money(appointment.price)}원</p>{appointment.notes && <p className="customer-history-note">{appointment.notes}</p>}</div><span className={`badge ${appointment.status === 'cancelled' ? 'cancelled' : appointment.paymentStatus === 'paid' ? 'paid' : 'scheduled'}`}>{appointment.status === 'cancelled' ? '예약 취소' : appointment.paymentStatus === 'paid' ? '정산 완료' : '예약 확정'}</span></article>)}</div> : <div className="customer-empty-history"><PawPrint size={22} /><p>이 아이에게 연결된 예약이 아직 없어요.</p><span>새 예약을 등록하거나 아래에서 기존 예약을 연결할 수 있어요.</span></div>}</section>
      {unlinked.length > 0 && <section className="customer-link-history"><h3><Link size={16} /> 기존 예약 이력 연결</h3><div className="field"><label htmlFor={`${id}-history`}>연결할 예약 선택</label><select id={`${id}-history`} value={linkId} onChange={(event) => setLinkId(event.target.value)} disabled={busy}><option value="">예약의 반려견과 보호자를 확인해 주세요</option>{unlinked.map((appointment) => <option key={appointment.id} value={appointment.id}>{appointment.date} {appointment.time} · {appointment.dogName} / {appointment.guardianName} · {appointment.phone || '연락처 없음'}</option>)}</select></div><p className="field-hint">같은 이름의 다른 아이는 아닌지 확인해 주세요. 기존 예약의 이름·금액·정산 내역은 유지하고 이력만 연결해요.</p><button type="button" className="btn btn-secondary btn-small" disabled={busy || !linkId} onClick={() => void run(async () => { await api(`/appointments/${linkId}/link-pet`, 'POST', { petId: pet.id }); onSaved(); })}>{busy ? <LoaderCircle size={15} className="spin" /> : <Link size={15} />}이 반려견 이력에 연결</button>{error && <p className="form-error" role="alert">{error}</p>}</section>}
    </div><footer className="modal-footer"><button type="button" className="btn btn-secondary" disabled={busy} onClick={onEdit}><Pencil size={15} />정보 수정</button><button type="button" className="btn btn-primary" disabled={busy} onClick={onBook}><Plus size={16} />이 아이 예약하기</button></footer>
  </Modal>;
}

export function CustomersPanel({ customers, pets, appointments, onSaved, onBook }: { customers: Customer[]; pets: Pet[]; appointments: Appointment[]; onSaved: () => void; onBook: (petId: string) => void }) {
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const normalized = query.trim().toLowerCase();
  const contains = (value: string) => value.toLowerCase().includes(normalized)
    || (/^[\d\s()+-]+$/.test(normalized) && normalized.replace(/\D/g, '') !== '' && value.replace(/\D/g, '').includes(normalized.replace(/\D/g, '')));
  const groups = customers.map((customer) => {
    const customerPets = pets.filter((pet) => pet.customerId === customer.id);
    const ownerMatches = contains(`${customer.name} ${customer.phone}`);
    return { customer, pets: ownerMatches ? customerPets : customerPets.filter((pet) => contains(`${pet.name} ${pet.breed}`)), visible: ownerMatches || customerPets.some((pet) => contains(`${pet.name} ${pet.breed}`)) };
  }).filter((group) => group.visible);
  const save = () => { setDialog(null); onSaved(); };
  const book = (petId: string) => { setDialog(null); onBook(petId); };
  return <div className="customers-panel">
    <div className="customer-toolbar"><label className="search-field"><Search size={17} /><input aria-label="고객 검색" placeholder="반려견 · 보호자 · 연락처 · 견종 검색" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" className="icon-button" aria-label="고객 검색 지우기" onClick={() => setQuery('')}><X size={15} /></button>}</label><div className="customer-toolbar-actions"><button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: 'customer' })}><UserRound size={16} />보호자만 등록</button><button type="button" className="btn btn-primary" onClick={() => setDialog({ type: 'register' })}><Plus size={17} />고객 · 반려견 등록</button></div></div>
    <div className="customer-list-caption"><span>보호자 <strong>{customers.length}</strong>명 · 반려견 <strong>{pets.length}</strong>마리</span><span>한 보호자 아래 여러 아이의 기록을 모아요</span></div>
    {groups.length ? <div className="customer-groups">{groups.map(({ customer, pets: customerPets }) => <section className="panel customer-card" key={customer.id}><header className="customer-card-header"><div className="customer-owner-info"><div className="customer-owner-avatar"><UserRound size={20} /></div><div><h2>{customer.name}<span>보호자</span></h2><p>{customer.phone || '연락처 미등록'}</p></div></div><div className="customer-owner-actions"><button type="button" className="icon-button" aria-label={`${customer.name} 보호자 정보 수정`} onClick={() => setDialog({ type: 'customer', customer })}><Pencil size={16} /></button><button type="button" className="btn btn-secondary btn-small" onClick={() => setDialog({ type: 'register', customerId: customer.id })}><Plus size={14} />반려견 추가</button></div></header>{customer.notes && <p className="customer-owner-note">{customer.notes}</p>}
      {customerPets.length ? <div className="customer-pet-grid">{customerPets.map((pet) => { const { latest, next, recommended } = visitInfo(pet, appointments); return <article className="customer-pet-card" key={pet.id}><button type="button" className="customer-pet-open" onClick={() => setDialog({ type: 'detail', pet })} aria-label={`${pet.name} 고객 장부 보기`}><div className="pet-avatar"><Dog size={27} /></div><div><h3>{pet.name}</h3><p>{pet.breed || '견종 미등록'}{pet.weight ? ` · ${pet.weight}kg` : ''}</p></div><ArrowRight size={16} /></button><div className="customer-pet-flags">{pet.allergies && <span><ShieldAlert size={12} />알레르기</span>}{pet.healthNotes && <span><Heart size={12} />건강 참고</span>}{pet.behaviorNotes && <span><PawPrint size={12} />행동 참고</span>}{!pet.allergies && !pet.healthNotes && !pet.behaviorNotes && <span className="neutral">주의사항 기록 없음</span>}</div><div className="customer-pet-visits"><span>최근 미용 <strong>{latest ? displayDate(latest.date) : '아직 없음'}</strong></span><span>{next ? '다음 예약' : '권장 방문'} <strong>{next ? `${displayDate(next.date)} ${next.time}` : recommended ? displayDate(recommended) : '아직 없음'}</strong></span></div><div className="customer-pet-actions"><button type="button" className="text-button" onClick={() => setDialog({ type: 'detail', pet })}>고객 장부 보기 <ArrowRight size={13} /></button><button type="button" className="btn btn-small btn-soft" onClick={() => book(pet.id)}><Plus size={14} />예약</button></div></article>; })}</div> : <div className="customer-no-pets"><Dog size={25} /><p>아직 등록된 반려견이 없어요.</p><button type="button" className="text-button" onClick={() => setDialog({ type: 'register', customerId: customer.id })}>첫 반려견 등록하기 <ArrowRight size={14} /></button></div>}
    </section>)}</div> : <section className="panel"><div className="empty-state"><div className="empty-illustration"><Users size={38} strokeWidth={1.4} /></div><h3>{query ? '검색 결과가 없어요' : '우리 가게의 첫 단골을 기록해요'}</h3><p>{query ? '반려견 이름, 보호자, 연락처 또는 견종을 확인해 주세요.' : '보호자와 아이의 정보를 한 번 등록하면 재방문 예약이 편해져요.'}</p>{!query && <button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: 'register' })}><Plus size={16} />첫 고객 등록하기</button>}</div></section>}
    {dialog?.type === 'register' && <PetForm customers={customers} customerId={dialog.customerId} onClose={() => setDialog(null)} onSaved={save} />}
    {dialog?.type === 'customer' && <CustomerForm initial={dialog.customer} onClose={() => setDialog(null)} onSaved={save} />}
    {dialog?.type === 'pet' && <PetForm customers={customers} initial={dialog.pet} onClose={() => setDialog(null)} onSaved={save} />}
    {dialog?.type === 'detail' && <PetDetail pet={dialog.pet} customer={customers.find((customer) => customer.id === dialog.pet.customerId)} appointments={appointments} onClose={() => setDialog(null)} onSaved={save} onEdit={() => setDialog({ type: 'pet', pet: dialog.pet })} onBook={() => book(dialog.pet.id)} />}
  </div>;
}
