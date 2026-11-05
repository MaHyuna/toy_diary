import { appUrl } from './routes';
import { useEffect, useRef, useState } from 'react';
import { Camera, Check, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, ImagePlus, LoaderCircle, Share2, Trash2 } from 'lucide-react';
import { Modal } from './Forms';
import { DatePicker } from './DatePicker';
import { compressPhoto } from './imageUpload';
import { careReportFile, downloadCareReport } from './care';
import { isDemo } from './runtime';
import { api } from './types';
import type { Appointment, CarePhoto, GroomingRecord } from './types';

type Draft = Pick<GroomingRecord, 'beforeNotes' | 'afterNotes' | 'groomerOpinion' | 'homeCare' | 'nextVisitDate' | 'photos'>;
type Operation = '' | 'photo' | 'save' | 'publish' | 'revoke';
type Props = { appointment: Appointment; initial?: GroomingRecord; onSaved: (record: GroomingRecord) => void; onClose: () => void };
const draftFrom = (record?: Draft | null): Draft => ({ beforeNotes: record?.beforeNotes ?? '', afterNotes: record?.afterNotes ?? '', groomerOpinion: record?.groomerOpinion ?? '', homeCare: record?.homeCare ?? '', nextVisitDate: record?.nextVisitDate ?? '', photos: record?.photos.map(photo => ({ ...photo })) ?? [] });
const signature = (draft?: Draft | null) => JSON.stringify(draftFrom(draft));
const meaningful = (draft: Draft) => draft.photos.length > 0 || [draft.beforeNotes, draft.afterNotes, draft.groomerOpinion, draft.homeCare].some(value => value.trim());
const hasDraft = (draft: Draft) => meaningful(draft) || !!draft.nextVisitDate;

/** Visit-specific customer-facing content; no internal appointment notes are copied here. */
export function GroomingRecordEditor({ appointment, initial, onSaved, onClose }: Props) {
  const [record, setRecord] = useState<GroomingRecord | null>(initial ?? null);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial));
  const [step, setStep] = useState(0);
  const [operation, setOperation] = useState<Operation>('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [discard, setDiscard] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const currentAppointment = useRef(appointment.id);
  const recordRef = useRef(record);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const dirty = signature(draft) !== signature(record);
  const published = !!record?.published && !!record.shareToken && !!record.publishedSnapshot;
  const changedSincePublish = published && (signature(record) !== signature(record.publishedSnapshot)
    || (['dogName', 'breed', 'weight', 'date', 'service'] as const).some(key => record.publishedSnapshot?.[key] !== appointment[key]));
  const busy = operation !== '';
  const stage: CarePhoto['stage'] = step === 0 ? 'before' : 'after';
  const stageName = stage === 'before' ? '미용 전' : '미용 후';
  const photos = draft.photos.filter(photo => photo.stage === stage);
  const shareUrl = record?.shareToken ? appUrl('care', { token: record.shareToken }) : '';

  useEffect(() => {
    if (currentAppointment.current !== appointment.id) {
      currentAppointment.current = appointment.id;
      recordRef.current = initial ?? null;
      setRecord(initial ?? null); setDraft(draftFrom(initial)); setStep(0);
      setError(''); setMessage(''); setDiscard(false);
      return;
    }
    if (!initial) return;
    const canReplaceDraft = signature(draftRef.current) === signature(recordRef.current);
    recordRef.current = initial;
    setRecord(initial);
    if (canReplaceDraft) setDraft(draftFrom(initial));
  }, [appointment.id, initial]);

  function update(key: Exclude<keyof Draft, 'photos'>, value: string) {
    setDraft(current => ({ ...current, [key]: value }));
    setMessage('');
  }
  function acceptSaved(result: GroomingRecord, replaceDraft = false) {
    recordRef.current = result;
    setRecord(result);
    if (replaceDraft) setDraft(draftFrom(result));
    setDiscard(false);
    onSaved(result);
  }
  function requestClose() {
    if (lock.current) return;
    if (dirty) setDiscard(true); else onClose();
  }
  function changeStep(next: number) {
    if (lock.current) return;
    setStep(next); setDateOpen(false); setDiscard(false);
    const modalBody = panel.current?.closest('.modal-body');
    if (modalBody) modalBody.scrollTop = 0;
  }
  async function addPhotos(files: FileList | null) {
    if (!files?.length || lock.current) return;
    const additions = Array.from(files), selectedStage = stage;
    if (draftRef.current.photos.filter(photo => photo.stage === selectedStage).length + additions.length > 4) {
      setError(`${selectedStage === 'before' ? '미용 전' : '미용 후'} 사진은 4장까지 넣을 수 있어요.`);
      if (upload.current) upload.current.value = ''; if (camera.current) camera.current.value = '';
      return;
    }
    lock.current = true; setOperation('photo'); setError(''); setMessage('');
    try {
      const prepared: CarePhoto[] = [];
      for (const file of additions) prepared.push({ id: crypto.randomUUID(), src: await compressPhoto(file, { maxChars: 100000, maxEdge: 960 }), stage: selectedStage, caption: '' });
      setDraft(current => ({ ...current, photos: [...current.photos, ...prepared] }));
      setMessage('사진을 넣었어요. 초안을 저장하면 이번 방문에 기록됩니다.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '사진을 읽지 못했어요. 기존 사진과 작성 내용은 유지됩니다.');
    } finally {
      lock.current = false; setOperation('');
      if (upload.current) upload.current.value = ''; if (camera.current) camera.current.value = '';
    }
  }
  async function saveDraft() {
    if (lock.current || (!hasDraft(draftRef.current) && !record) || (!dirty && record)) return;
    lock.current = true; setOperation('save'); setError(''); setMessage('');
    const submitted = draftFrom(draftRef.current);
    try {
      const result = await api<GroomingRecord>(`/appointments/${appointment.id}/care`, 'PATCH', submitted);
      acceptSaved(result, true);
      setMessage(result.published ? '초안을 저장했어요. 보호자에게는 기존 공개 내용이 유지됩니다.' : '비공개 초안을 저장했어요.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '초안을 저장하지 못했어요. 사진과 작성 내용은 유지됩니다.');
    } finally { lock.current = false; setOperation(''); }
  }
  async function publish() {
    if (lock.current || dirty || !record || !meaningful(draftFrom(record))) return;
    lock.current = true; setOperation('publish'); setError(''); setMessage('');
    try {
      const result = await api<GroomingRecord>(`/appointments/${appointment.id}/care/publish`, 'POST', {});
      acceptSaved(result);
      setMessage('저장한 내용을 보호자에게 공개했어요.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '공개하지 못했어요. 저장된 초안은 유지됩니다.'); }
    finally { lock.current = false; setOperation(''); }
  }
  async function revoke() {
    if (lock.current || !published) return;
    lock.current = true; setOperation('revoke'); setError(''); setMessage('');
    try {
      const result = await api<GroomingRecord>(`/appointments/${appointment.id}/care/publish`, 'DELETE');
      acceptSaved(result);
      setMessage('공개를 해제했어요. 이전 링크로는 기록을 볼 수 없습니다.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '공개 해제에 실패했어요. 현재 공개 상태를 확인해 주세요.'); }
    finally { lock.current = false; setOperation(''); }
  }
  async function copyLink() {
    if (!published || !shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); setMessage('보호자용 링크를 복사했어요.'); }
    catch { setError('링크를 복사하지 못했어요. 아래 주소를 직접 복사해 주세요.'); }
  }
  async function shareLink() {
    if (!published || !shareUrl) return;
    if (isDemo && record?.publishedSnapshot) {
      try {
        const file = careReportFile(record.publishedSnapshot);
        if (navigator.canShare?.({ files: [file] }) && navigator.share) await navigator.share({ files: [file], title: `${appointment.dogName} 케어 기록` });
        else { downloadCareReport(record.publishedSnapshot); setMessage('고객용 기록 파일을 저장했어요. 다른 기기에는 이 파일을 전달해 주세요.'); }
      } catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError('공유하지 못했어요. 고객용 기록 파일 저장을 이용해 주세요.'); }
      return;
    }
    if (!navigator.share) { await copyLink(); return; }
    try { await navigator.share({ title: `${appointment.dogName} 미용 기록`, text: '미용 전후 상태와 집에서 관리할 내용을 확인해 주세요.', url: shareUrl }); }
    catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError('공유하지 못했어요. 링크 복사나 고객용 기록 파일 저장을 이용해 주세요.'); }
  }

  return <Modal title="미용 기록 작성" description={`${appointment.dogName} · ${appointment.date} · ${appointment.service}`} onClose={requestClose} busy={busy} className="care-editor care-record-editor">
    <div className="modal-body">
      <nav className="care-steps" aria-label="미용 기록 작성 단계">
        {['미용 전', '미용 후', '소견 · 집 관리'].map((label, index) => <button key={label} type="button" data-autofocus={index === 0 ? '' : undefined} aria-current={step === index ? 'step' : undefined} disabled={busy} onClick={() => changeStep(index)}><span>{index + 1}</span>{label}</button>)}
      </nav>
      <div className="care-draft-status" role="status">{dirty ? '저장하지 않은 초안' : record ? '초안 저장됨' : '이번 방문의 새 기록'}<span>{published ? changedSincePublish ? '공개 후 초안 변경' : '보호자 공개 중' : '비공개'}</span></div>
      {discard && <div className="care-discard-state" role="alert"><p>저장하지 않은 사진이나 글이 있어요. 닫으면 이 변경사항이 사라집니다.</p><div><button type="button" className="btn btn-secondary btn-small" onClick={() => setDiscard(false)}>계속 작성</button><button type="button" className="text-button" onClick={onClose}>저장하지 않고 닫기</button></div></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="care-status-message" role="status">{message}</p>}
      <div ref={panel} className="care-step-panel">
        {step < 2 ? <>
          <div className="care-photo-heading"><h3>{stageName} 사진</h3><span>{photos.length}/4</span></div>
          {photos.length > 0 ? <div className="care-photo-grid">{photos.map((photo, index) => <figure className="care-photo-item" key={photo.id}><img src={photo.src} alt={`${stageName} ${index + 1}`} /><figcaption>{stageName} {index + 1}</figcaption><button type="button" aria-label={`${stageName} 사진 ${index + 1} 삭제`} disabled={busy} onClick={() => { setDraft(current => ({ ...current, photos: current.photos.filter(item => item.id !== photo.id) })); setMessage(''); }}><Trash2 size={16} /></button></figure>)}</div> : <div className="care-photo-empty"><ImagePlus size={24} /><p>{stageName} 모습을 남겨 주세요.</p><span>사진 없이 글만 기록해도 괜찮아요.</span></div>}
          <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden aria-label={`${stageName} 사진 파일`} disabled={busy} onChange={event => void addPhotos(event.target.files)} />
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden aria-label={`${stageName} 촬영 파일`} disabled={busy} onChange={event => void addPhotos(event.target.files)} />
          <div className="care-photo-actions"><button type="button" className="btn btn-secondary" disabled={busy || photos.length >= 4} onClick={() => upload.current?.click()}>{operation === 'photo' ? <LoaderCircle size={16} className="spin" /> : <ImagePlus size={16} />}{operation === 'photo' ? '사진 준비 중…' : '사진 올리기'}</button><button type="button" className="btn btn-secondary" disabled={busy || photos.length >= 4} onClick={() => camera.current?.click()}><Camera size={16} />촬영</button></div>
          <label className="care-field">{step === 0 ? '미용 전 상태' : '미용 후 결과'}<textarea rows={5} maxLength={2000} disabled={busy} value={step === 0 ? draft.beforeNotes : draft.afterNotes} onChange={event => update(step === 0 ? 'beforeNotes' : 'afterNotes', event.target.value)} placeholder={step === 0 ? '털 엉킴, 피부에서 보인 점, 보호자와 확인한 내용을 기록해 주세요.' : '진행한 미용과 마무리 상태, 보호자에게 전할 변화를 기록해 주세요.'} /></label>
        </> : <div className="care-fields">
          <p className="care-field-help">이곳에 작성한 내용은 공개할 때 보호자에게 그대로 보입니다.</p>
          <label className="care-field">미용사 소견<textarea rows={4} maxLength={2000} disabled={busy} value={draft.groomerOpinion} onChange={event => update('groomerOpinion', event.target.value)} placeholder="미용 중 관찰한 점과 다음 방문에 참고할 내용을 적어 주세요." /></label>
          <label className="care-field">집에서 관리할 것<textarea rows={4} maxLength={2000} disabled={busy} value={draft.homeCare} onChange={event => update('homeCare', event.target.value)} placeholder="빗질, 건조, 관리 시 주의할 내용을 보호자가 이해하기 쉽게 적어 주세요." /></label>
          <div className="care-next-visit"><span>다음 방문 권장일 <small>선택 사항</small></span><div><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setDateOpen(value => !value)}>{draft.nextVisitDate || '날짜 고르기'}</button>{draft.nextVisitDate && <button type="button" className="text-button" disabled={busy} onClick={() => { update('nextVisitDate', ''); setDateOpen(false); }}>지우기</button>}</div>{dateOpen && <DatePicker label="다음 방문 권장일" value={draft.nextVisitDate || appointment.date} min={appointment.date} max="2100-12-31" disabled={busy} onChange={date => { update('nextVisitDate', date); setDateOpen(false); }} onClose={() => setDateOpen(false)} />}</div>
          <details className="care-draft-preview"><summary>보호자에게 보여줄 내용 미리보기</summary><div className="care-preview-content"><h3>{appointment.dogName}의 미용 기록</h3><p>{appointment.date} · {appointment.service}</p>{(['before', 'after'] as const).map(part => { const items = draft.photos.filter(photo => photo.stage === part), text = part === 'before' ? draft.beforeNotes : draft.afterNotes; return (items.length > 0 || text) && <section key={part}><h4>{part === 'before' ? '미용 전' : '미용 후'}</h4>{items.length > 0 && <div className="care-photo-grid">{items.map(photo => <img src={photo.src} alt={part === 'before' ? '미용 전 사진' : '미용 후 사진'} key={photo.id} />)}</div>}{text && <p>{text}</p>}</section>; })}{draft.groomerOpinion && <section><h4>미용사 소견</h4><p>{draft.groomerOpinion}</p></section>}{draft.homeCare && <section><h4>집에서 관리할 것</h4><p>{draft.homeCare}</p></section>}{draft.nextVisitDate && <p>다음 방문 권장일 {draft.nextVisitDate}</p>}</div></details>
          <section className="care-publish-state" aria-label="보호자 공개 설정"><div><h3>{published ? '보호자에게 공개 중' : '아직 보호자에게 공개되지 않았어요'}</h3><p>{published ? changedSincePublish || dirty ? '보호자에게는 이전에 공개한 내용이 보입니다. 초안 저장 후 공개 내용을 갱신해 주세요.' : '현재 저장된 공개 내용을 링크나 기록 파일로 전달할 수 있어요.' : '초안 저장 후 공개 버튼을 누르면 보호자용 기록이 만들어집니다.'}</p></div>
            <button type="button" className="btn btn-primary" disabled={busy || dirty || !record || !meaningful(draftFrom(record)) || published && !changedSincePublish} onClick={() => void publish()}>{operation === 'publish' ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{operation === 'publish' ? '공개 중…' : published ? '공개 내용 갱신' : '보호자에게 공개'}</button>
            <p className="care-field-help">{appointment.petId ? '같은 아이의 공개된 방문 기록도 함께 보입니다.' : '이 방문의 공개 기록만 보입니다.'}</p>{dirty && <small>공개하기 전에 초안을 저장해 주세요.</small>}
            {published && <><div className="care-share-actions"><a className="btn btn-secondary" href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />공개 화면 보기</a><button type="button" className="btn btn-secondary" onClick={() => void copyLink()} disabled={busy}><Copy size={15} />{isDemo ? '체험 링크 복사' : '링크 복사'}</button>{typeof navigator.share === 'function' && <button type="button" className="btn btn-secondary" onClick={() => void shareLink()} disabled={busy}><Share2 size={15} />{isDemo ? '기록 파일 공유' : '공유'}</button>}<button type="button" className="btn btn-secondary" disabled={busy || !record?.publishedSnapshot} onClick={() => { if (record?.publishedSnapshot) downloadCareReport(record.publishedSnapshot); }}><Download size={15} />고객용 기록 파일 저장</button></div><label className="care-link-field">보호자용 주소<input value={shareUrl} readOnly onFocus={event => event.target.select()} /></label><button type="button" className="text-button" disabled={busy} onClick={() => void revoke()}>{operation === 'revoke' ? '공개 해제 중…' : '공개 해제 · 이전 링크 차단'}</button></>}
            {isDemo && <p className="care-demo-note">체험 링크는 이 브라우저의 데이터로만 열립니다. 다른 기기로 전달하려면 고객용 기록 파일을 저장해 공유하세요.</p>}
          </section>
        </div>}
      </div>
    </div>
    <footer className="modal-footer care-editor-footer"><button type="button" className="btn btn-secondary" disabled={busy || step === 0} onClick={() => changeStep(step - 1)}><ChevronLeft size={16} />이전</button>{step < 2 && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => changeStep(step + 1)}>다음<ChevronRight size={16} /></button>}<button type="button" className="btn btn-primary" disabled={busy || !hasDraft(draft) && !record || !dirty && !!record} onClick={() => void saveDraft()}>{operation === 'save' ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{operation === 'save' ? '저장 중…' : '초안 저장'}</button></footer>
  </Modal>;
}
