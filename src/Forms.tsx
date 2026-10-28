import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowRightLeft, Banknote, Check, CreditCard, LoaderCircle, Plus, Trash2, X } from 'lucide-react';
import { api, categories, money, paymentLabels, today } from './types';
import type { Appointment, Customer, PaymentMethod, Pet, Pricing, Shampoo } from './types';

type FormCallbacks = { onSaved: () => void; onClose: () => void };

export function Modal({ title, description, children, onClose, busy = false, className = '' }: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  className?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>('[data-autofocus]')
      ?? dialog?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    // Open mobile sheets without summoning the keyboard before the user taps a field.
    (window.matchMedia('(max-width: 760px)').matches ? dialog : first ?? dialog)?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busyRef.current) closeRef.current();
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      )).filter((element) => element.getClientRects().length > 0);
      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      if (!firstElement) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === firstElement || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && (document.activeElement === lastElement || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        firstElement.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>('[data-primary-add]')?.focus({ preventScroll: true });
    };
  }, []);

  return <div className={`modal-backdrop ${className}`} onClick={(event) => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined} aria-busy={busy} tabIndex={-1}>
      <header className="modal-header">
        <div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
        <button type="button" className="modal-close" aria-label="닫기" onClick={onClose} disabled={busy}><X size={20} /></button>
      </header>
      {children}
    </div>
  </div>;
}

function useSubmission(onSaved: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  async function run(operation: () => Promise<unknown>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await operation();
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}

function FormError({ error }: { error: string }) {
  return error ? <p className="form-error" role="alert">{error}</p> : null;
}

function SaveButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <button type="submit" className="btn btn-primary" disabled={busy}>
    {busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}
    {busy ? '저장 중…' : children}
  </button>;
}

function shampooCost(purchasePrice: number, volumeMl: number, usedMl: string) {
  if (!(volumeMl > 0) || !(Number(usedMl) > 0) || !Number.isFinite(Number(usedMl))) return 0;
  // Decimal fractions keep the preview's whole-won rounding consistent with the server.
  const fraction = (value: number) => {
    const [mantissa, exponentText = '0'] = value.toString().toLowerCase().split('e');
    const [whole, decimal = ''] = mantissa.split('.');
    const scale = decimal.length - Number(exponentText);
    return scale >= 0 ? [BigInt(whole + decimal), 10n ** BigInt(scale)]
      : [BigInt(whole + decimal) * 10n ** BigInt(-scale), 1n];
  };
  const [priceNumerator, priceDenominator] = fraction(purchasePrice);
  const [volumeNumerator, volumeDenominator] = fraction(volumeMl);
  const [usedNumerator, usedDenominator] = fraction(Number(usedMl));
  const numerator = priceNumerator * usedNumerator * volumeDenominator;
  const denominator = priceDenominator * usedDenominator * volumeNumerator;
  return Number((numerator * 2n + denominator) / (denominator * 2n));
}

export function AppointmentForm({ initial, defaultPetId, date, pricing, customers, pets, shampoos, onSaved, onClose }: FormCallbacks & {
  initial?: Appointment; defaultPetId?: string; date: string; pricing: Pricing;
  customers: Customer[]; pets: Pet[]; shampoos: Shampoo[];
}) {
  const formId = useId();
  const defaultService = pricing.services[0];
  const defaultPet = initial ? undefined : pets.find((pet) => pet.id === defaultPetId);
  const defaultCustomer = customers.find((customer) => customer.id === defaultPet?.customerId);
  const findBreedRule = (breed: string) => pricing.breedRules.find((rule) => rule.breed.trim().toLowerCase() === breed.trim().toLowerCase());
  const findWeightRule = (weight: number | null) => weight === null ? undefined : pricing.weightRules.find((rule) =>
    weight >= rule.minWeight && (weight < rule.maxWeight || (rule.maxWeight === 150 && weight === 150)),
  );
  const [petId, setPetId] = useState(initial?.petId ?? defaultPet?.id ?? '');
  const [values, setValues] = useState({
    dogName: initial?.dogName ?? defaultPet?.name ?? '', guardianName: initial?.guardianName ?? defaultCustomer?.name ?? '',
    phone: initial?.phone ?? defaultCustomer?.phone ?? '', breed: initial?.breed ?? defaultPet?.breed ?? '', weight: initial ? initial.weight?.toString() ?? '' : defaultPet?.weight?.toString() ?? '',
    service: initial?.service ?? defaultService?.name ?? '', date: initial?.date ?? date, time: initial?.time ?? '10:00',
    duration: String(initial?.duration ?? defaultService?.duration ?? 60),
    basePrice: String(initial?.basePrice ?? initial?.price ?? defaultService?.basePrice ?? 0),
    breedSurcharge: String(initial?.breedSurcharge ?? findBreedRule(defaultPet?.breed ?? '')?.amount ?? 0),
    weightSurcharge: String(initial?.weightSurcharge ?? findWeightRule(defaultPet?.weight ?? null)?.amount ?? 0),
    notes: initial?.notes ?? '',
  });
  const [extras, setExtras] = useState(() => (initial?.extraCharges ?? []).map((charge, index) => ({
    rowId: String(index), label: charge.label, amount: String(charge.amount),
  })));
  const nextExtraId = useRef(extras.length);
  const [usage, setUsage] = useState(() => (initial?.shampooUsage ?? []).map((item, index) => ({
    rowId: String(index), shampooId: item.shampooId, usedMl: String(item.usedMl), customerCharge: String(item.customerCharge),
  })));
  const nextUsageId = useRef(usage.length);
  const selectedPet = pets.find((pet) => pet.id === petId);
  const availableShampoos = shampoos.filter((shampoo) => !shampoo.archived);
  const nextShampoo = availableShampoos.find((shampoo) => !usage.some((row) => row.shampooId === shampoo.id));
  const usagePreviews = usage.map((row) => {
    const snapshot = initial?.shampooUsage.find((saved) => saved.shampooId === row.shampooId
      && saved.usedMl === Number(row.usedMl));
    const shampoo = shampoos.find((item) => item.id === row.shampooId);
    return { ...row, shampoo, snapshot, cost: snapshot?.cost ?? (shampoo ? shampooCost(shampoo.purchasePrice, shampoo.volumeMl, row.usedMl) : 0) };
  });
  const estimatedShampooCost = usagePreviews.reduce((sum, item) => sum + item.cost, 0);
  const shampooSurcharge = usage.reduce((sum, item) => sum + Number(item.customerCharge), 0);
  const { busy, error, run } = useSubmission(onSaved);
  const update = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const total = Number(values.basePrice) + Number(values.breedSurcharge) + Number(values.weightSurcharge)
    + extras.reduce((sum, charge) => sum + Number(charge.amount), 0) + shampooSurcharge;
  function updatePricingInput(key: 'service' | 'breed' | 'weight', value: string) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      const preset = pricing.services.find((service) => service.name.trim().toLowerCase() === next.service.trim().toLowerCase());
      const breedRule = findBreedRule(next.breed);
      const weight = next.weight === '' ? null : Number(next.weight);
      const weightRule = findWeightRule(weight);
      return {
        ...next,
        basePrice: String(preset?.basePrice ?? (key === 'service' ? 0 : Number(current.basePrice))),
        duration: key === 'service' && preset ? String(preset.duration) : current.duration,
        breedSurcharge: String(breedRule?.amount ?? 0),
        weightSurcharge: String(weightRule?.amount ?? 0),
      };
    });
  }
  function choosePet(value: string) {
    setPetId(value);
    const pet = pets.find((item) => item.id === value);
    if (!pet) return;
    const customer = customers.find((item) => item.id === pet.customerId);
    setValues((current) => {
      const preset = pricing.services.find((service) => service.name.trim().toLowerCase() === current.service.trim().toLowerCase());
      return {
        ...current, dogName: pet.name, guardianName: customer?.name ?? '', phone: customer?.phone ?? '',
        breed: pet.breed, weight: pet.weight?.toString() ?? '',
        basePrice: String(preset?.basePrice ?? Number(current.basePrice)),
        breedSurcharge: String(findBreedRule(pet.breed)?.amount ?? 0),
        weightSurcharge: String(findWeightRule(pet.weight)?.amount ?? 0),
      };
    });
  }
  function updateUsage(rowId: string, key: 'shampooId' | 'usedMl' | 'customerCharge', value: string) {
    setUsage((current) => current.map((row) => row.rowId === rowId ? { ...row, [key]: value } : row));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(() => api(initial ? `/appointments/${initial.id}` : '/appointments', initial ? 'PATCH' : 'POST', {
      ...values,
      dogName: values.dogName.trim(), guardianName: values.guardianName.trim(), service: values.service.trim(),
      weight: values.weight === '' ? null : Number(values.weight), duration: Number(values.duration), price: total,
      basePrice: Number(values.basePrice), breedSurcharge: Number(values.breedSurcharge), weightSurcharge: Number(values.weightSurcharge),
      extraCharges: extras.map(({ label, amount }) => ({ label: label.trim(), amount: Number(amount) })),
      staffId: initial?.staffId ?? 'owner',
      petId: petId || null,
      shampooUsage: usage.map(({ shampooId, usedMl, customerCharge }) => ({ shampooId, usedMl: Number(usedMl), customerCharge: Number(customerCharge) })),
    }));
  }
  return <Modal title={initial ? '예약 수정' : '새 예약'} description="반려견을 고르고 방문 시간을 정해 주세요." onClose={onClose} busy={busy} className="appointment-form">
    <form onSubmit={submit}>
      <div className="modal-body">
        <div className="form-grid">
          <div className="field field-full"><label htmlFor={`${formId}-pet`}>등록된 반려견</label>
            <select id={`${formId}-pet`} value={petId} onChange={(event) => choosePet(event.target.value)} disabled={busy}>
              <option value="">직접 입력 · 고객 기록에 연결하지 않음</option>
              {petId && !selectedPet && <option value={petId}>기존 반려견 연결 유지</option>}
              {pets.map((pet) => {
                const customer = customers.find((item) => item.id === pet.customerId);
                return <option value={pet.id} key={pet.id}>{pet.name} · {customer?.name ?? '보호자 미등록'}{customer?.phone ? ` · ${customer.phone}` : ''}</option>;
              })}
            </select>
            <p className="field-hint">새 고객과 반려견은 고객 관리에서 등록할 수 있어요.{petId && ' 아래 정보를 수정해도 이번 방문 기록만 변경돼요.'}</p>
          </div>
          {selectedPet && (selectedPet.allergies || selectedPet.behaviorNotes || selectedPet.healthNotes || selectedPet.preferredStyle) && <div className="pet-visit-notes field-full">
            <strong>기억해 둘 반려견 메모</strong>
            {selectedPet.allergies && <p><span>알레르기</span>{selectedPet.allergies}</p>}
            {selectedPet.healthNotes && <p><span>건강 관련 메모</span>{selectedPet.healthNotes}</p>}
            {selectedPet.behaviorNotes && <p><span>행동 특성</span>{selectedPet.behaviorNotes}</p>}
            {selectedPet.preferredStyle && <p><span>선호 스타일</span>{selectedPet.preferredStyle}</p>}
          </div>}
          <div className="field"><label htmlFor={`${formId}-dog`}>반려견 이름 <span aria-hidden="true">*</span></label>
            <input id={`${formId}-dog`} value={values.dogName} onChange={(e) => update('dogName', e.target.value)} required maxLength={80} placeholder="예: 몽이" disabled={busy} data-autofocus /></div>
          <div className="field"><label htmlFor={`${formId}-guardian`}>보호자 이름 <span aria-hidden="true">*</span></label>
            <input id={`${formId}-guardian`} value={values.guardianName} onChange={(e) => update('guardianName', e.target.value)} required maxLength={80} placeholder="예: 김몽글" disabled={busy} /></div>
          <div className="field"><label htmlFor={`${formId}-phone`}>보호자 연락처</label>
            <input id={`${formId}-phone`} type="tel" value={values.phone} onChange={(e) => update('phone', e.target.value)} maxLength={40} placeholder="010-0000-0000" disabled={busy} /></div>
          <div className="field"><label htmlFor={`${formId}-breed`}>견종</label>
            <input id={`${formId}-breed`} list={`${formId}-breeds`} value={values.breed} onChange={(e) => updatePricingInput('breed', e.target.value)} maxLength={80} placeholder="예: 비숑 프리제" disabled={busy} />
            <datalist id={`${formId}-breeds`}>{pricing.breedRules.map((rule) => <option key={rule.id} value={rule.breed} />)}</datalist></div>
          <div className="field"><label htmlFor={`${formId}-weight`}>몸무게 (kg)</label>
            <input id={`${formId}-weight`} type="number" min="0.1" max="150" step="0.1" value={values.weight} onChange={(e) => updatePricingInput('weight', e.target.value)} placeholder="예: 4.5" disabled={busy} /></div>
          <div className="field"><label htmlFor={`${formId}-service`}>미용 서비스 <span aria-hidden="true">*</span></label>
            <input id={`${formId}-service`} list={`${formId}-services`} value={values.service} onChange={(e) => updatePricingInput('service', e.target.value)} required maxLength={100} disabled={busy} />
            <datalist id={`${formId}-services`}>{pricing.services.map((service) => <option key={service.id} value={service.name} />)}</datalist></div>
          <h3 className="form-section-title field-full">언제 방문하나요?</h3>
          <div className="field"><label htmlFor={`${formId}-date`}>예약 날짜 <span aria-hidden="true">*</span></label>
            <input id={`${formId}-date`} type="date" value={values.date} onChange={(e) => update('date', e.target.value)} required disabled={busy} /></div>
          <div className="field"><label htmlFor={`${formId}-time`}>예약 시간 <span aria-hidden="true">*</span></label>
            <input id={`${formId}-time`} type="time" value={values.time} onChange={(e) => update('time', e.target.value)} required disabled={busy} /></div>
          <div className="field"><label htmlFor={`${formId}-duration`}>소요 시간 (분) <span aria-hidden="true">*</span></label>
            <input id={`${formId}-duration`} type="number" min="1" max="480" step="1" value={values.duration} onChange={(e) => update('duration', e.target.value)} required disabled={busy} /></div>
          <div className="field"><label htmlFor={`${formId}-base`}>서비스 기본요금 (원)</label>
            <input id={`${formId}-base`} type="number" min="0" max="100000000" step="1" value={values.basePrice} onChange={(e) => update('basePrice', e.target.value)} required disabled={busy} /></div>
          <div className="field"><label htmlFor={`${formId}-breed-fee`}>견종 추가요금 (원)</label>
            <input id={`${formId}-breed-fee`} type="number" min="0" max="100000000" step="1" value={values.breedSurcharge} onChange={(e) => update('breedSurcharge', e.target.value)} required disabled={busy} /></div>
          <div className="field"><label htmlFor={`${formId}-weight-fee`}>몸무게 추가요금 (원)</label>
            <input id={`${formId}-weight-fee`} type="number" min="0" max="100000000" step="1" value={values.weightSurcharge} onChange={(e) => update('weightSurcharge', e.target.value)} required disabled={busy} /></div>
          <p className="field-hint field-full">요금표 기준으로 계산했어요. 현장 상황에 맞게 조정할 수 있어요. 서비스·견종·몸무게를 바꾸면 요금표의 금액을 다시 적용합니다.</p>
          <details className="form-disclosure field-full" open={!!initial?.extraCharges.length}><summary>현장 추가요금<span>{extras.length ? `${extras.length}개 항목` : "입질 · 엉킴 등"}</span></summary>
          <div className="field field-full extra-charges">
            <div className="extra-charges-header"><span>현장 추가요금</span><button type="button" className="btn btn-secondary" disabled={busy || extras.length >= 20} onClick={() => {
              const rowId = String(nextExtraId.current++);
              setExtras((current) => [...current, { rowId, label: '', amount: '' }]);
            }}><Plus size={15} />항목 추가</button></div>
            {extras.length === 0 && <p className="field-hint">입질 대응, 심한 엉킴 등 추가 작업이 생기면 사유와 금액을 남겨주세요.</p>}
            {extras.map((charge, index) => <div className="extra-charge-row" key={charge.rowId}>
              <div className="field"><label htmlFor={`${formId}-extra-label-${charge.rowId}`}>추가요금 {index + 1} 사유</label>
                <input id={`${formId}-extra-label-${charge.rowId}`} list={`${formId}-extra-reasons`} value={charge.label} maxLength={100} placeholder="예: 심한 엉킴" required disabled={busy} onChange={(e) => setExtras((current) => current.map((item) => item.rowId === charge.rowId ? { ...item, label: e.target.value } : item))} /></div>
              <div className="field"><label htmlFor={`${formId}-extra-amount-${charge.rowId}`}>추가요금 {index + 1} 금액 (원)</label>
                <input id={`${formId}-extra-amount-${charge.rowId}`} type="number" min="0" max="100000000" step="1" value={charge.amount} placeholder="0" required disabled={busy} onChange={(e) => setExtras((current) => current.map((item) => item.rowId === charge.rowId ? { ...item, amount: e.target.value } : item))} /></div>
              <button type="button" className="btn btn-secondary" aria-label={`추가요금 ${index + 1} 삭제`} disabled={busy} onClick={() => setExtras((current) => current.filter((item) => item.rowId !== charge.rowId))}><Trash2 size={16} /></button>
            </div>)}
            <datalist id={`${formId}-extra-reasons`}><option value="입질 대응" /><option value="심한 엉킴" /><option value="추가 작업" /></datalist>
          </div>
          </details>
          <details className="form-disclosure field-full" open={!!initial?.shampooUsage.length}><summary>샴푸 사용 기록<span>{usage.length ? `${usage.length}개 제품` : "제품 · 사용량"}</span></summary>
          <div className="field field-full shampoo-usage">
            <div className="extra-charges-header"><span>사용한 샴푸</span><button type="button" className="btn btn-secondary" disabled={busy || usage.length >= 10 || !nextShampoo} onClick={() => {
              if (!nextShampoo) return;
              const rowId = String(nextUsageId.current++);
              setUsage((current) => [...current, { rowId, shampooId: nextShampoo.id, usedMl: '', customerCharge: '0' }]);
            }}><Plus size={15} />샴푸 사용 추가</button></div>
            {!usage.length && <p className="field-hint">{availableShampoos.length ? '실제로 사용한 원액량을 입력하면 이번 미용의 샴푸 원가를 확인할 수 있어요.' : '샴푸 관리에 제품과 구입 금액을 등록하면 사용 원가를 계산할 수 있어요.'}</p>}
            {usagePreviews.map((row, index) => <div className="shampoo-usage-row" key={row.rowId}>
              <div className="field field-full"><label htmlFor={`${formId}-shampoo-${row.rowId}`}>사용 샴푸 {index + 1}</label>
                <select id={`${formId}-shampoo-${row.rowId}`} value={row.shampooId} onChange={(event) => updateUsage(row.rowId, 'shampooId', event.target.value)} disabled={busy} required>
                  {row.shampooId && !row.shampoo && <option value={row.shampooId}>{row.snapshot?.name ?? '기존 샴푸'} · 저장된 사용 기록</option>}
                  {shampoos.filter((shampoo) => !shampoo.archived || shampoo.id === row.shampooId).map((shampoo) => <option key={shampoo.id} value={shampoo.id} disabled={usage.some((item) => item.rowId !== row.rowId && item.shampooId === shampoo.id)}>{shampoo.id === row.shampooId && row.snapshot ? row.snapshot.name : shampoo.name}{shampoo.archived ? ' · 사용 중지' : ''}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor={`${formId}-used-${row.rowId}`}>샴푸 {index + 1} 원액 사용량 (mL)</label>
                <input id={`${formId}-used-${row.rowId}`} type="number" min="0.01" max="1000000" step="any" value={row.usedMl} onChange={(event) => updateUsage(row.rowId, 'usedMl', event.target.value)} required disabled={busy || !!row.shampoo?.archived} placeholder="예: 20" /></div>
              <div className="field"><label htmlFor={`${formId}-charge-${row.rowId}`}>샴푸 {index + 1} 고객 추가요금 (원)</label>
                <input id={`${formId}-charge-${row.rowId}`} type="number" min="0" max="100000000" step="1" value={row.customerCharge} onChange={(event) => updateUsage(row.rowId, 'customerCharge', event.target.value)} required disabled={busy || !!row.shampoo?.archived} /></div>
              <div className="shampoo-usage-meta field-full"><div>
                <strong>사용 원가 {money(row.cost)}원</strong>
                {row.snapshot && <span>저장된 원가 기준</span>}
                {row.shampoo && <p>{row.shampoo.dilutionWaterRatio > 0 ? `제품에 등록된 희석 비율: 원액 1 : 물 ${row.shampoo.dilutionWaterRatio}` : '희석비 미등록 · 제품 라벨을 확인해 주세요.'}{row.shampoo.archived ? ' · 현재 사용 중지된 제품이에요.' : ''}</p>}
              </div><button type="button" className="btn btn-secondary" aria-label={`사용 샴푸 ${index + 1} 삭제`} disabled={busy} onClick={() => setUsage((current) => current.filter((item) => item.rowId !== row.rowId))}><Trash2 size={16} /></button></div>
            </div>)}
            {usage.length > 0 && <div className="shampoo-cost-summary"><span>이번 방문 샴푸 사용 원가</span><strong>{money(estimatedShampooCost)}원</strong><span>고객 추가요금</span><strong>{money(shampooSurcharge)}원</strong></div>}
            <p className="field-hint">샴푸 구매비는 지출로 기록해요. 여기의 사용 원가는 참고용이며 가계부에서 다시 차감하지 않아요.</p>
          </div>
          </details>
          <div className="field field-full"><label htmlFor={`${formId}-price`}>예상 총금액 (원)</label>
            <input id={`${formId}-price`} type="number" value={total} readOnly aria-describedby={`${formId}-total-description`} />
            <p id={`${formId}-total-description`} className="field-hint">기본요금 + 견종 추가요금 + 몸무게 추가요금 + 현장 추가요금 + 샴푸 고객 추가요금</p></div>
          <div className="field field-full"><label htmlFor={`${formId}-notes`}>미용 메모</label>
            <textarea id={`${formId}-notes`} rows={3} value={values.notes} onChange={(e) => update('notes', e.target.value)} maxLength={2000} placeholder="알레르기, 예민한 부위, 원하는 스타일 등을 남겨주세요." disabled={busy} /></div>
        </div>
        <FormError error={error} />
      </div>
      <footer className="modal-footer"><div className="booking-save-total" aria-live="polite"><span>예약 금액</span><strong>{money(total)}원</strong></div><SaveButton busy={busy}>{initial ? '변경 사항 저장' : '예약 등록'}</SaveButton></footer>
    </form>
  </Modal>;
}

export function ExpenseForm({ date, onSaved, onClose }: FormCallbacks & { date: string }) {
  const formId = useId();
  const [values, setValues] = useState({ date: date > today() ? today() : date, category: categories[0], amount: '', memo: '' });
  const { busy, error, run } = useSubmission(onSaved);
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(() => api('/expenses', 'POST', { ...values, amount: Number(values.amount) }));
  }
  return <Modal title="지출 기록" description="가게를 위해 쓴 비용을 빠짐없이 기록해요." onClose={onClose} busy={busy}>
    <form onSubmit={submit}>
      <div className="modal-body"><div className="form-grid">
        <div className="field"><label htmlFor={`${formId}-date`}>지출 날짜</label>
          <input id={`${formId}-date`} type="date" value={values.date} max={today()} onChange={(e) => setValues({ ...values, date: e.target.value })} required disabled={busy} /></div>
        <div className="field"><label htmlFor={`${formId}-category`}>분류</label>
          <select id={`${formId}-category`} value={values.category} onChange={(e) => setValues({ ...values, category: e.target.value })} disabled={busy}>{categories.map((category) => <option key={category}>{category}</option>)}</select></div>
        <div className="field field-full"><label htmlFor={`${formId}-amount`}>지출 금액 (원)</label>
          <input id={`${formId}-amount`} type="number" min="1" max="100000000" step="1" value={values.amount} onChange={(e) => setValues({ ...values, amount: e.target.value })} placeholder="0" required disabled={busy} data-autofocus /></div>
        <div className="field field-full"><label htmlFor={`${formId}-memo`}>내용</label>
          <textarea id={`${formId}-memo`} rows={3} value={values.memo} onChange={(e) => setValues({ ...values, memo: e.target.value })} maxLength={2000} placeholder="예: 저자극 샴푸 2개 구입" disabled={busy} /></div>
      </div><FormError error={error} /></div>
      <footer className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>취소</button><SaveButton busy={busy}>지출 저장</SaveButton></footer>
    </form>
  </Modal>;
}

export function SettleForm({ appointment, onSaved, onClose }: FormCallbacks & { appointment: Appointment }) {
  const formId = useId();
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [paidDate, setPaidDate] = useState(today());
  const { busy, error, run } = useSubmission(onSaved);
  const methodIcons = { card: CreditCard, cash: Banknote, transfer: ArrowRightLeft };
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(() => api(`/appointments/${appointment.id}/settle`, 'POST', { paymentMethod: method, paidDate }));
  }
  return <Modal title="미용 완료 · 결제 확인" description={`${appointment.dogName} · ${appointment.service}`} onClose={onClose} busy={busy}>
    <form onSubmit={submit}>
      <div className="modal-body">
        <div className="amount-preview"><span>최종 미용 금액</span><strong>{money(appointment.price)}<small>원</small></strong></div>
        <div className="form-grid">
          <div className="field field-full"><span>결제 수단</span>
            <div className="segmented" role="group" aria-label="결제 수단">
              {(['card', 'cash', 'transfer'] as PaymentMethod[]).map((value) => {
                const Icon = methodIcons[value];
                return <button type="button" key={value} className={method === value ? 'active' : ''} aria-pressed={method === value} onClick={() => setMethod(value)} disabled={busy}>
                  <Icon size={18} />{paymentLabels[value]}
                </button>;
              })}
            </div>
          </div>
          <div className="field field-full"><label htmlFor={`${formId}-paid-date`}>실제 결제일</label>
            <input id={`${formId}-paid-date`} type="date" value={paidDate} max={today()} onChange={(e) => setPaidDate(e.target.value)} required disabled={busy} /></div>
          <p className="field-hint field-full">결제까지 확인하면 미용 완료로 기록돼요. 추가요금이 있다면 먼저 예약·요금 수정에서 반영해 주세요. 완료 후에는 금액과 예약을 수정할 수 없어요.</p>
        </div><FormError error={error} />
      </div>
      <footer className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>취소</button><SaveButton busy={busy}>완료 · 결제 기록</SaveButton></footer>
    </form>
  </Modal>;
}

export function ConfirmDialog({ title, description, onConfirm, onClose, confirmLabel = '확인' }: {
  title: string; description: string; onConfirm: () => Promise<void>; onClose: () => void; confirmLabel?: string;
}) {
  const { busy, error, run } = useSubmission(onClose);
  return <Modal title={title} onClose={onClose} busy={busy}>
    <div className="modal-body"><p>{description}</p><FormError error={error} /></div>
    <footer className="modal-footer">
      <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy} data-autofocus>돌아가기</button>
      <button type="button" className="btn btn-danger" onClick={() => void run(onConfirm)} disabled={busy}>{busy && <LoaderCircle size={17} className="spin" />}{busy ? '처리 중…' : confirmLabel}</button>
    </footer>
  </Modal>;
}
