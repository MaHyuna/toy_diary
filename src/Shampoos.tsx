import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Archive, Check, Droplets, FlaskConical, Pencil, Plus, RotateCcw } from 'lucide-react';
import { Modal } from './Forms';
import { api, money } from './types';
import type { Appointment, Shampoo } from './types';

function ShampooForm({ initial, onClose, onSaved }: { initial?: Shampoo; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: initial?.name ?? '', purchasePrice: String(initial?.purchasePrice ?? ''), volumeMl: String(initial?.volumeMl ?? ''), dilutionWaterRatio: String(initial?.dilutionWaterRatio ?? 0), notes: initial?.notes ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const update = (key: keyof typeof form, value: string) => setForm(v => ({ ...v, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending.current) return; pending.current = true; setBusy(true); setError('');
    try {
      await api(initial ? `/shampoos/${initial.id}` : '/shampoos', initial ? 'PATCH' : 'POST', { ...form, name: form.name.trim(), purchasePrice: Number(form.purchasePrice), volumeMl: Number(form.volumeMl), dilutionWaterRatio: Number(form.dilutionWaterRatio) });
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '제품을 저장하지 못했어요.'); }
    finally { pending.current = false; setBusy(false); }
  }
  const unitCost = Number(form.volumeMl) > 0 ? Number(form.purchasePrice) / Number(form.volumeMl) : 0;
  return <Modal title={initial ? '샴푸 정보 수정' : '사용하는 샴푸 등록'} description="제품의 실제 구매가와 용량으로 사용 원가를 계산해요." onClose={onClose} busy={busy}>
    <form onSubmit={submit}><div className="modal-body"><div className="form-grid">
      <div className="field field-full"><label htmlFor="shampoo-name">제품명</label><input id="shampoo-name" value={form.name} required maxLength={100} disabled={busy} onChange={e => update('name', e.target.value)} placeholder="예: 저자극 보습 샴푸" data-autofocus /></div>
      <div className="field"><label htmlFor="shampoo-purchase">한 병 구매금액 (원)</label><input id="shampoo-purchase" type="number" min="0" max="100000000" step="1" value={form.purchasePrice} required disabled={busy} onChange={e => update('purchasePrice', e.target.value)} /></div>
      <div className="field"><label htmlFor="shampoo-volume">한 병 원액 용량 (mL)</label><input id="shampoo-volume" type="number" min="0.1" max="1000000" step="0.1" value={form.volumeMl} required disabled={busy} onChange={e => update('volumeMl', e.target.value)} /></div>
      <div className="field field-full"><label htmlFor="shampoo-dilution">제조사 안내 희석비 · 샴푸 1 : 물 N</label><input id="shampoo-dilution" type="number" min="0" max="1000" step="0.1" value={form.dilutionWaterRatio} required disabled={busy} onChange={e => update('dilutionWaterRatio', e.target.value)} /><p className="field-hint">확인하지 않았다면 0으로 두세요. 제품 라벨의 비율을 기록하는 칸이며, 앱이 권장하는 희석비가 아니에요.</p></div>
      <div className="field field-full"><label htmlFor="shampoo-notes">제품 메모</label><textarea id="shampoo-notes" value={form.notes} maxLength={2000} rows={3} disabled={busy} onChange={e => update('notes', e.target.value)} placeholder="제품 특성, 라벨 주의사항, 구매처 등을 기록하세요." /></div>
      <div className="amount-preview field-full"><span>원액 1mL당 예상 원가</span><strong>{unitCost.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}<small>원</small></strong></div>
      <p className="field-hint field-full">제품 등록만으로 지출이 생기지는 않아요. 실제 구매 비용은 가계부에 ‘샴푸 구매’로 기록하세요. 가격을 바꿔도 기존 방문의 사용 원가는 유지돼요.</p>
    </div>{error && <p className="form-error" role="alert">{error}</p>}</div><footer className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>취소</button><button type="submit" className="btn btn-primary" disabled={busy}><Check size={16} />{busy ? '저장 중…' : '제품 저장'}</button></footer></form>
  </Modal>;
}

export function ShampoosPanel({ shampoos, appointments, onSaved, onExpense }: { shampoos: Shampoo[]; appointments: Appointment[]; onSaved: () => void; onExpense: () => void }) {
  const [editing, setEditing] = useState<Shampoo | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const busy = useRef(false);
  const visible = shampoos.filter(s => showArchived || !s.archived);
  async function archive(shampoo: Shampoo) {
    if (busy.current) return; busy.current = true; setBusyId(shampoo.id); setError('');
    try { await api(`/shampoos/${shampoo.id}`, 'PATCH', { archived: !shampoo.archived }); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '상태를 변경하지 못했어요.'); }
    finally { busy.current = false; setBusyId(''); }
  }
  return <div className="supplies-page">
    <div className="workflow-strip"><div><span>01</span><strong>제품 구매가 기록</strong><p>실제 한 병 가격과 원액 용량</p></div><i>→</i><div><span>02</span><strong>예약에 사용량 기록</strong><p>방문별 원액 mL와 고객 추가요금</p></div><i>→</i><div><span>03</span><strong>원가를 따로 확인</strong><p>구매 지출에서 다시 차감하지 않아요</p></div></div>
    <div className="customer-toolbar"><div><strong>우리 가게 샴푸 <span className="count-pill">{shampoos.filter(s => !s.archived).length}</span></strong><p>추가요금을 받지 않는 기본 샴푸도 기록할 수 있어요.</p></div><div className="row-actions"><button className="btn btn-secondary" onClick={onExpense}>구매 지출 기록</button><button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} />제품 등록</button></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <label className="archive-toggle"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />사용 중지한 제품도 보기</label>
    {visible.length ? <div className="shampoo-grid">{visible.map(s => {
      const records = appointments.filter(a => a.paymentStatus === 'paid').flatMap(a => a.shampooUsage ?? []).filter(u => u.shampooId === s.id);
      return <article className={`panel shampoo-card ${s.archived ? 'archived' : ''}`} key={s.id}><div className="shampoo-card-heading"><div className="shampoo-icon"><FlaskConical size={26} /></div><div><h2>{s.name}</h2><span>{s.archived ? '사용 중지' : '사용 중'} · {s.volumeMl.toLocaleString('ko-KR')}mL</span></div><button className="icon-button" aria-label={`${s.name} 수정`} onClick={() => setEditing(s)}><Pencil size={16} /></button></div><div className="shampoo-price"><span>원액 1mL당</span><strong>{(s.purchasePrice / s.volumeMl).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}<small>원</small></strong><p>한 병 구매가 {money(s.purchasePrice)}원</p></div><dl className="shampoo-facts"><div><dt>등록한 희석비</dt><dd>{s.dilutionWaterRatio > 0 ? `샴푸 1 : 물 ${s.dilutionWaterRatio}` : '미등록 · 제품 라벨 확인'}</dd></div><div><dt>정산된 방문의 누적 사용량</dt><dd>{records.reduce((sum, u) => sum + u.usedMl, 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}mL</dd></div><div><dt>정산된 방문의 누적 원가</dt><dd>{money(records.reduce((sum, u) => sum + u.cost, 0))}원</dd></div></dl>{s.notes && <p className="shampoo-note">{s.notes}</p>}<footer><span><Droplets size={12} />원액 사용량 기준</span><button className="text-button" disabled={!!busyId} onClick={() => void archive(s)}>{s.archived ? <RotateCcw size={13} /> : <Archive size={13} />}{busyId === s.id ? '변경 중…' : s.archived ? '다시 사용' : '사용 중지'}</button></footer></article>;
    })}</div> : <section className="panel empty-state"><div className="empty-illustration"><FlaskConical size={37} /></div><h3>사용하는 샴푸부터 기록해 보세요</h3><p>제품의 실제 구매가와 용량을 등록하면 방문별 사용량에 따른 원가를 확인할 수 있어요.</p><button className="btn btn-secondary" onClick={() => setEditing('new')}><Plus size={15} />첫 제품 등록</button></section>}
    <div className="cost-explainer"><strong>고객 요금과 원가는 다른 기록이에요.</strong><p>고객 추가요금은 매출에 반영돼요. 사용 원가는 운영을 위한 참고 값이며, 가계부의 구매 지출과 중복 차감하지 않아요. 재고 수량·자동 발주·회계상 재고자산 평가는 제공하지 않아요.</p></div>
    {editing && <ShampooForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onSaved(); }} />}
  </div>;
}
