import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share2, X } from 'lucide-react';
import { money } from './types';
import type { Appointment, PetPhoto, Pricing } from './types';
import { Modal } from './Forms';

function studioName() { try { return localStorage.getItem('mongle-studio-name') || '몽글 미용실'; } catch { return '몽글 미용실'; } }

type Line = { label: string; value?: string };
async function loadImage(src: string) { const img = new Image(); img.src = src; await img.decode(); return img; }
export function ShareCard({ title, subtitle, lines, photos = [], onClose }: { title: string; subtitle: string; lines: Line[]; photos?: PetPhoto[]; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null); const [ready, setReady] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function draw() {
      const banner = await loadImage('./images/studio-art.webp');
      const images = await Promise.all(photos.map(photo => loadImage(photo.src)));
      if (!active || !canvas.current) return;
      const el = canvas.current; const ctx = el.getContext('2d')!;
      ctx.font = '24px sans-serif';
      const wrapped: Line[] = [];
      for (const line of lines) {
        let part = ''; const limit = line.value ? 430 : 660;
        for (const char of line.label) { if (ctx.measureText(part + char).width > limit) { wrapped.push({ label: part }); part = ''; } part += char; }
        wrapped.push({ label: part, value: line.value });
      }
      el.width = 800; el.height = 370 + wrapped.length * 60 + Math.ceil(images.length / 2) * 320 + 100;
      ctx.fillStyle = '#fffdf8'; ctx.fillRect(0, 0, el.width, el.height);
      const cropHeight = banner.width * 280 / 800;
      ctx.drawImage(banner, 0, (banner.height - cropHeight) / 2, banner.width, cropHeight, 0, 0, 800, 280);
      const gradient = ctx.createLinearGradient(0, 0, 800, 0); gradient.addColorStop(0, '#fffdf8'); gradient.addColorStop(.32, '#fffdf8fa'); gradient.addColorStop(.65, '#fffdf890'); gradient.addColorStop(1, '#fffdf800'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 800, 280);
      ctx.fillStyle = '#28604a'; ctx.font = 'bold 19px sans-serif'; ctx.fillText(studioName(), 48, 68, 680);
      ctx.fillStyle = '#243a2c'; ctx.font = 'bold 38px sans-serif'; ctx.fillText(title, 48, 136, 680);
      ctx.font = '22px sans-serif'; ctx.fillStyle = '#5f7563'; ctx.fillText(subtitle, 48, 190, 680);
      let y = 330;
      for (const line of wrapped) { ctx.font = '24px sans-serif'; ctx.fillStyle = '#425646'; ctx.textAlign = 'left'; ctx.fillText(line.label, 48, y, line.value ? 450 : 700); if (line.value) { ctx.textAlign = 'right'; ctx.font = 'bold 25px sans-serif'; ctx.fillStyle = '#244b34'; ctx.fillText(line.value, 752, y, 245); } ctx.strokeStyle = '#e6e9de'; ctx.beginPath(); ctx.moveTo(48, y + 23); ctx.lineTo(752, y + 23); ctx.stroke(); y += 60; }
      ctx.textAlign = 'left';
      images.forEach((img, index) => { const x = 48 + index % 2 * 360, top = y + Math.floor(index / 2) * 320; const scale = Math.min(344 / img.width, 250 / img.height); ctx.drawImage(img, x + (344 - img.width * scale) / 2, top, img.width * scale, img.height * scale); ctx.font = '18px sans-serif'; ctx.fillStyle = '#627362'; ctx.fillText(photos[index].caption || photos[index].date, x, top + 280, 340); });
      ctx.fillStyle = '#7b8979'; ctx.font = '18px sans-serif'; ctx.fillText(`소중한 아이의 다음 방문도 함께할게요.  ·  ${studioName()}`, 48, el.height - 46, 700);
      setReady(true);
    }
    void draw().catch(() => { if (active) setError('안내 이미지를 만들지 못했어요. 다시 열어 주세요.'); });
    return () => { active = false; };
  }, [title, subtitle, lines, photos]);
  async function file() { const blob = await new Promise<Blob | null>(resolve => canvas.current?.toBlob(resolve, 'image/png')); if (!blob) throw new Error('이미지를 만들지 못했어요.'); return new File([blob], `${title}.png`, { type: 'image/png' }); }
  async function download() { setError(''); try { const image = await file(); const url = URL.createObjectURL(image); const a = document.createElement('a'); a.href = url; a.download = image.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); } catch { setError('저장하지 못했어요. 다시 시도해 주세요.'); } }
  async function share() { setError(''); try { const image = await file(); if (navigator.canShare?.({ files: [image] })) await navigator.share({ files: [image], title }); else await download(); } catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError('공유하지 못했어요. 이미지 저장을 이용해 주세요.'); } }
  return createPortal(<Modal title="고객에게 보여주기" description="아래 내용만 이미지에 포함돼요. 저장하거나 메시지 앱으로 공유하세요." onClose={onClose} className="share-card-modal"><div className="share-preview"><canvas ref={canvas} role="img" aria-label={`${title} 고객 안내 이미지`} />{error && <p role="alert" className="form-error">{error}</p>}</div><footer className="modal-footer"><button className="btn btn-secondary" disabled={!ready} onClick={() => void download()}><Download size={17} />이미지 저장</button><button className="btn btn-primary" disabled={!ready} onClick={() => void share()}><Share2 size={17} />공유하기</button></footer></Modal>, document.querySelector('.app-shell')!);
}
export function VisitReport({ appointment: a, photos = [] }: { appointment: Appointment; photos?: PetPhoto[] }) {
  const [open, setOpen] = useState(false); const [preview, setPreview] = useState(false); const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(photos.filter(photo => photo.date === a.date).map(photo => photo.id));
  const lines = [{ label: '미용 서비스', value: a.service }, { label: '방문일', value: a.date }, { label: '반려견', value: `${a.breed || '견종 미등록'}${a.weight ? ` · ${a.weight}kg` : ''}` }, { label: '기본 미용', value: `${money(a.basePrice)}원` }, ...(a.breedSurcharge ? [{ label: '견종 추가금', value: `${money(a.breedSurcharge)}원` }] : []), ...(a.weightSurcharge ? [{ label: '체중 추가금', value: `${money(a.weightSurcharge)}원` }] : []), ...a.extraCharges.map(c => ({ label: c.label, value: `${money(c.amount)}원` })), ...(a.shampooSurcharge ? [{ label: '샴푸 추가금', value: `${money(a.shampooSurcharge)}원` }] : []), { label: a.paymentStatus === 'paid' ? '결제한 금액' : '예상 금액', value: `${money(a.price)}원` }, ...(message ? [{ label: `보호자 안내 · ${message}` }] : [])];
  return <><button className="btn btn-secondary" onClick={() => setOpen(true)}><Share2 size={16} />미용표 보여주기</button>{open && <div className="report-builder"><div><h3>보호자에게 전할 내용</h3><button className="icon-button" aria-label="미용표 작성 닫기" onClick={() => setOpen(false)}><X size={18} /></button></div><textarea aria-label="보호자 안내 문구" placeholder="예: 오늘은 얼굴을 동그랗게 정리했어요. 다음 방문은 6주 뒤를 권해요." value={message} maxLength={600} onChange={e => setMessage(e.target.value)} /><p>내부 미용 메모·연락처·건강 참고사항은 포함하지 않아요. 공유할 사진을 직접 선택하세요.</p><div className="report-photos">{photos.map(photo => <label key={photo.id}><img src={photo.src} alt={photo.caption || '미용 사진'} /><input type="checkbox" checked={selected.includes(photo.id)} onChange={e => setSelected(e.target.checked ? [...selected, photo.id] : selected.filter(id => id !== photo.id))} />{photo.date}</label>)}</div><button className="btn btn-primary" onClick={() => setPreview(true)}>고객용 미용표 미리보기</button></div>}{preview && <ShareCard title={`${a.dogName}의 미용 기록`} subtitle={`${a.date} · ${a.paymentStatus === 'paid' ? '미용 완료' : '예약 안내'}`} lines={lines} photos={photos.filter(photo => selected.includes(photo.id))} onClose={() => setPreview(false)} />}</>;
}
export function PricePreview({ pricing }: { pricing: Pricing }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(studioName); const [nameError, setNameError] = useState('');
  const lines = [...pricing.services.map(s => ({ label: s.name, value: `${money(s.basePrice)}원 · ${s.duration}분` })), ...pricing.breedRules.map(r => ({ label: `${r.breed} 추가`, value: `${money(r.amount)}원` })), ...pricing.weightRules.map(r => ({ label: `${r.minWeight}kg 이상–${r.maxWeight}kg ${r.maxWeight === 150 ? '이하' : '미만'}`, value: `+${money(r.amount)}원` })), { label: '견종·몸무게 추가금은 기본 미용 요금에 합산됩니다.' }, { label: '입질·엉킴·추가 작업 비용은 상담 후 별도 안내합니다.' }];
  return <><div className="studio-name-field"><label htmlFor="studio-name">고객에게 표시할 매장 이름</label><input id="studio-name" maxLength={40} value={name} onChange={e => { setName(e.target.value); try { localStorage.setItem('mongle-studio-name', e.target.value); setNameError(''); } catch { setNameError('매장 이름을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.'); } }} />{nameError && <p role="alert">{nameError}</p>}</div><section className="price-showcase"><div className="salon-hero"><img src="./images/studio-art.webp" alt="비숑과 푸들이 함께 있는 몽글 미용실 일러스트" /><div><span>{name || '몽글 미용실'}</span><h2>우리 아이를 위한<br />다정한 미용.</h2><p>서비스 · 요금 안내</p></div></div><div className="public-price-list">{pricing.services.map(s => <div key={s.id}><span><strong>{s.name}</strong><small>{s.duration}분 소요</small></span><b>{money(s.basePrice)}<small>원</small></b></div>)}</div><button className="btn btn-primary" onClick={() => setOpen(true)}><Share2 size={17} />고객용 요금표 보기 · 공유</button><p className="price-caption">저장한 서비스·견종·몸무게 요금으로 안내 이미지를 만들어요.</p></section>{open && <ShareCard title="미용 요금 안내" subtitle="우리 아이에게 맞는 미용을 상담해 주세요." lines={lines} onClose={() => setOpen(false)} />}</>;
}
