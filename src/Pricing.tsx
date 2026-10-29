import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Dog, LoaderCircle, Plus, Scissors, Scale, Trash2 } from 'lucide-react';
import { PricePreview } from './ShareCard';
import { api, money } from './types';
import type { Pricing } from './types';

type ServiceDraft = { id: string; name: string; basePrice: string; duration: string };
type BreedDraft = { id: string; breed: string; amount: string };
type WeightDraft = { id: string; minWeight: string; maxWeight: string; amount: string };
type PricingDraft = { services: ServiceDraft[]; breedRules: BreedDraft[]; weightRules: WeightDraft[] };

function draftFrom(pricing: Pricing): PricingDraft {
  return {
    services: pricing.services.map((service) => ({ ...service, basePrice: String(service.basePrice), duration: String(service.duration) })),
    breedRules: pricing.breedRules.map((rule) => ({ ...rule, amount: String(rule.amount) })),
    weightRules: pricing.weightRules.map((rule) => ({ ...rule, minWeight: String(rule.minWeight), maxWeight: String(rule.maxWeight), amount: String(rule.amount) })),
  };
}

export function PricingPanel({ pricing, onSaved }: { pricing: Pricing; onSaved: () => void }) {
  const formId = useId();
  const [draft, setDraft] = useState<PricingDraft>(() => draftFrom(pricing));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const pricingFingerprint = JSON.stringify(pricing);
  useEffect(() => {
    setDraft(draftFrom(JSON.parse(pricingFingerprint) as Pricing));
    setError('');
  }, [pricingFingerprint]);
  const changed = JSON.stringify(draft) !== JSON.stringify(draftFrom(pricing));

  function updateService(id: string, key: Exclude<keyof ServiceDraft, 'id'>, value: string) {
    setDraft((current) => ({ ...current, services: current.services.map((row) => row.id === id ? { ...row, [key]: value } : row) }));
  }
  function updateBreed(id: string, key: Exclude<keyof BreedDraft, 'id'>, value: string) {
    setDraft((current) => ({ ...current, breedRules: current.breedRules.map((row) => row.id === id ? { ...row, [key]: value } : row) }));
  }
  function updateWeight(id: string, key: Exclude<keyof WeightDraft, 'id'>, value: string) {
    setDraft((current) => ({ ...current, weightRules: current.weightRules.map((row) => row.id === id ? { ...row, [key]: value } : row) }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError('');
    const payload: Pricing = {
      services: draft.services.map((row) => ({ ...row, name: row.name.trim(), basePrice: Number(row.basePrice), duration: Number(row.duration) })),
      breedRules: draft.breedRules.map((row) => ({ ...row, breed: row.breed.trim(), amount: Number(row.amount) })),
      weightRules: draft.weightRules.map((row) => ({ ...row, minWeight: Number(row.minWeight), maxWeight: Number(row.maxWeight), amount: Number(row.amount) })),
    };
    try {
      const saved = await api<Pricing>('/pricing', 'PUT', payload);
      setDraft(draftFrom(saved));
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '요금표를 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <form className="pricing-panel" onSubmit={submit} aria-busy={busy}>
    <div className="pricing-intro">
      <div><strong>우리 가게만의 요금 기준을 정해요.</strong><p>처음 제공되는 기본 요금은 예시예요. 실제 매장 요금으로 수정해 주세요.</p></div>
      <span className="soft-tag">기본가 + 견종 + 몸무게 + 현장 추가 요금</span>
    </div>

    <section className="panel">
      <div className="panel-heading"><div><div className="section-eyebrow">SERVICE PRICING</div><h2><Scissors size={20} /> 서비스 기본 요금</h2></div><button type="button" className="btn btn-secondary btn-small" disabled={busy || draft.services.length >= 30} onClick={() => setDraft((current) => ({ ...current, services: [...current.services, { id: crypto.randomUUID(), name: '', basePrice: '', duration: '60' }] }))}><Plus size={15} />서비스 추가</button></div>
      <div className="pricing-rows">
        {draft.services.map((row, index) => <div className="pricing-row pricing-service-row" key={row.id}>
          <div className="field"><label htmlFor={`${formId}-service-${row.id}-name`}>서비스 이름</label><input id={`${formId}-service-${row.id}-name`} aria-label={`${index + 1}번째 서비스 이름`} value={row.name} onChange={(e) => updateService(row.id, 'name', e.target.value)} maxLength={100} required disabled={busy} placeholder="예: 전체 미용" /></div>
          <div className="field"><label htmlFor={`${formId}-service-${row.id}-price`}>기본 금액 (원)</label><input id={`${formId}-service-${row.id}-price`} aria-label={`${index + 1}번째 서비스 기본 금액`} type="number" min="0" max="100000000" step="1" value={row.basePrice} onChange={(e) => updateService(row.id, 'basePrice', e.target.value)} required disabled={busy} placeholder="0" /></div>
          <div className="field"><label htmlFor={`${formId}-service-${row.id}-duration`}>소요 시간 (분)</label><input id={`${formId}-service-${row.id}-duration`} aria-label={`${index + 1}번째 서비스 소요 시간`} type="number" min="1" max="480" step="1" value={row.duration} onChange={(e) => updateService(row.id, 'duration', e.target.value)} required disabled={busy} /></div>
          <button type="button" className="icon-button subtle-danger" aria-label={`${row.name || `${index + 1}번째 서비스`} 삭제`} title={draft.services.length === 1 ? '서비스는 하나 이상 필요해요' : '서비스 삭제'} disabled={busy || draft.services.length === 1} onClick={() => setDraft((current) => ({ ...current, services: current.services.filter((service) => service.id !== row.id) }))}><Trash2 size={17} /></button>
        </div>)}
      </div>
      <p className="panel-footnote">예약에서 서비스를 고르면 기본 금액과 소요 시간이 입력돼요. 개별 예약에 맞춰 조정할 수 있어요.</p>
    </section>

    <section className="panel">
      <div className="panel-heading"><div><div className="section-eyebrow">BREED ADJUSTMENTS</div><h2><Dog size={20} /> 견종별 추가 요금</h2></div><button type="button" className="btn btn-secondary btn-small" disabled={busy || draft.breedRules.length >= 100} onClick={() => setDraft((current) => ({ ...current, breedRules: [...current.breedRules, { id: crypto.randomUUID(), breed: '', amount: '' }] }))}><Plus size={15} />견종 추가</button></div>
      <div className="pricing-rows">
        {draft.breedRules.length ? draft.breedRules.map((row, index) => <div className="pricing-row pricing-rule-row" key={row.id}>
          <div className="field"><label htmlFor={`${formId}-breed-${row.id}-name`}>견종</label><input id={`${formId}-breed-${row.id}-name`} aria-label={`${index + 1}번째 요금표 견종`} value={row.breed} onChange={(e) => updateBreed(row.id, 'breed', e.target.value)} maxLength={80} required disabled={busy} placeholder="예: 비숑 프리제" /></div>
          <div className="field"><label htmlFor={`${formId}-breed-${row.id}-amount`}>추가 금액 (원)</label><input id={`${formId}-breed-${row.id}-amount`} aria-label={`${index + 1}번째 견종 추가 금액`} type="number" min="0" max="100000000" step="1" value={row.amount} onChange={(e) => updateBreed(row.id, 'amount', e.target.value)} required disabled={busy} placeholder="0" /></div>
          <button type="button" className="icon-button subtle-danger" aria-label={`${row.breed || `${index + 1}번째 견종`} 요금 삭제`} disabled={busy} onClick={() => setDraft((current) => ({ ...current, breedRules: current.breedRules.filter((rule) => rule.id !== row.id) }))}><Trash2 size={17} /></button>
        </div>) : <div className="pricing-empty"><Dog size={23} /><p>견종에 따라 달라지는 요금이 있다면 추가해 주세요.</p><span>등록하지 않으면 기본 서비스 요금만 적용돼요.</span></div>}
      </div>
      <p className="panel-footnote">예약에 입력한 견종 이름과 일치하면 적용돼요. 몸무게별 추가 요금과 함께 더해져요.</p>
    </section>

    <section className="panel">
      <div className="panel-heading"><div><div className="section-eyebrow">WEIGHT ADJUSTMENTS</div><h2><Scale size={20} /> 몸무게별 추가 요금</h2></div><button type="button" className="btn btn-secondary btn-small" disabled={busy || draft.weightRules.length >= 100} onClick={() => setDraft((current) => ({ ...current, weightRules: [...current.weightRules, { id: crypto.randomUUID(), minWeight: '', maxWeight: '', amount: '' }] }))}><Plus size={15} />구간 추가</button></div>
      <div className="pricing-rows">
        {draft.weightRules.length ? draft.weightRules.map((row, index) => <div className="pricing-row pricing-weight-row" key={row.id}>
          <div className="field"><label htmlFor={`${formId}-weight-${row.id}-min`}>최소 몸무게 (kg 이상)</label><input id={`${formId}-weight-${row.id}-min`} aria-label={`${index + 1}번째 구간 최소 몸무게`} type="number" min="0" max="150" step="0.1" value={row.minWeight} onChange={(e) => updateWeight(row.id, 'minWeight', e.target.value)} required disabled={busy} placeholder="예: 5" /></div>
          <div className="field"><label htmlFor={`${formId}-weight-${row.id}-max`}>최대 몸무게 (kg 미만)</label><input id={`${formId}-weight-${row.id}-max`} aria-label={`${index + 1}번째 구간 최대 몸무게`} type="number" min="0.1" max="150" step="0.1" value={row.maxWeight} onChange={(e) => updateWeight(row.id, 'maxWeight', e.target.value)} required disabled={busy} placeholder="예: 10" /></div>
          <div className="field"><label htmlFor={`${formId}-weight-${row.id}-amount`}>추가 금액 (원)</label><input id={`${formId}-weight-${row.id}-amount`} aria-label={`${index + 1}번째 몸무게 구간 추가 금액`} type="number" min="0" max="100000000" step="1" value={row.amount} onChange={(e) => updateWeight(row.id, 'amount', e.target.value)} required disabled={busy} placeholder="0" /></div>
          <button type="button" className="icon-button subtle-danger" aria-label={`${index + 1}번째 몸무게 구간 삭제`} disabled={busy} onClick={() => setDraft((current) => ({ ...current, weightRules: current.weightRules.filter((rule) => rule.id !== row.id) }))}><Trash2 size={17} /></button>
        </div>) : <div className="pricing-empty"><Scale size={23} /><p>몸무게에 따른 요금 구간을 설정할 수 있어요.</p><span>예: 5kg 이상 10kg 미만 · 추가 {money(10000)}원</span></div>}
      </div>
      <p className="panel-footnote">구간은 겹치지 않게 등록해 주세요. 최소 이상·최대 미만 기준이며, 최대가 150kg이면 150kg도 포함해요.</p>
    </section>

    <div className="pricing-save-bar">
      <div><strong>{changed ? '변경한 요금표를 저장해 주세요' : '저장된 요금표를 사용하고 있어요'}</strong><p>기존 예약의 견적은 바뀌지 않아요. 입질·엉킴 등 현장 추가 요금은 예약별로 기록해요.</p></div>
      <button type="submit" className="btn btn-primary" disabled={busy || !changed}>{busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}{busy ? '저장 중…' : '요금표 저장'}</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>;
}

export function PricingPage({ pricing, onSaved }: { pricing: Pricing; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  return <div className="pricing-page"><div className="pricing-mode"><button className={!editing ? 'active' : ''} onClick={() => setEditing(false)}>고객에게 보여주기</button><button className={editing ? 'active' : ''} onClick={() => setEditing(true)}>요금 편집</button></div>{editing ? <PricingPanel pricing={pricing} onSaved={() => { setEditing(false); onSaved(); }} /> : <PricePreview pricing={pricing} />}</div>;
}
