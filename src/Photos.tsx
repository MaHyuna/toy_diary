import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from './Forms';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { api, today } from './types';
import type { Pet, PetPhoto } from './types';

async function compress(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > 20_000_000) throw new Error('20MB 이하의 사진을 선택해 주세요.');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('이 사진을 읽을 수 없어요. JPG·PNG·WebP 사진으로 다시 선택해 주세요.'); });
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let src = canvas.toDataURL('image/jpeg', .78);
    if (src.length > 350000) src = canvas.toDataURL('image/jpeg', .45);
    if (src.length > 350000) throw new Error('사진이 너무 복잡해요. 작은 사진으로 다시 선택해 주세요.');
    return src;
  } finally { bitmap.close(); }
}
export function PetAvatar({ pet }: { pet: Pet }) {
  return <img className="pet-photo-avatar" loading="lazy" decoding="async" src={pet.photos?.[0]?.src || './images/studio-art.webp'} alt={`${pet.name} ${pet.photos?.length ? '사진' : '기본 일러스트'}`} />;
}
export function PhotoAlbum({ pet, onChange }: { pet: Pet; onChange: (photos: PetPhoto[]) => void }) {
  const [photos, setPhotos] = useState(pet.photos ?? []);
  const [viewing, setViewing] = useState<PetPhoto | null>(null);
  const [caption, setCaption] = useState(''); const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const upload = useRef<HTMLInputElement>(null); const camera = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  async function save(next: PetPhoto[]) {
    await api(`/pets/${pet.id}`, 'PATCH', { photos: next }); setPhotos(next); onChange(next);
  }
  async function add(file?: File) {
    if (!file || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { if (photos.length >= 6) throw new Error('사진은 아이당 6장까지 저장할 수 있어요.'); const src = await compress(file); await save([...photos, { id: crypto.randomUUID(), src, caption: caption.trim(), date }]); setCaption(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '사진을 저장하지 못했어요. 저장 공간을 확인해 주세요.'); }
    finally { lock.current = false; setBusy(false); if (upload.current) upload.current.value = ''; if (camera.current) camera.current.value = ''; }
  }
  return <section className="photo-album"><div className="album-heading"><div><span className="section-eyebrow">GROOMING GALLERY</span><h3>미용 사진 <small>{photos.length}/6</small></h3></div><Camera size={22} /></div>
    {photos.length ? <div className="photo-grid">{photos.map(photo => <figure key={photo.id}><button type="button" className="photo-open" aria-label={`${photo.caption || pet.name} 사진 확대`} onClick={() => setViewing(photo)}><img src={photo.src} alt={photo.caption || `${pet.name} 미용 사진`} /></button><figcaption>{photo.caption || '미용 기록'}<small>{photo.date}</small></figcaption><button type="button" className="photo-delete" aria-label={`${photo.caption || pet.name} 사진 삭제`} disabled={busy} onClick={async () => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await save(photos.filter(item => item.id !== photo.id)); } catch { setError('사진을 삭제하지 못했어요. 다시 시도해 주세요.'); } finally { lock.current = false; setBusy(false); } }}><Trash2 size={16} /></button></figure>)}</div> : <div className="album-empty"><ImagePlus size={28} /><p>미용 전·후 사진을 남겨 주세요.</p><span>사진을 누르면 원본 비율로 저장할 수 있어요.</span></div>}
    <div className="photo-inputs"><label>사진 설명<input aria-label="사진 설명" maxLength={120} value={caption} placeholder="예: 미용 후 · 곰돌이 컷" onChange={e => setCaption(e.target.value)} disabled={busy} /></label><label>촬영일<input aria-label="사진 촬영일" type="date" value={date} required onChange={e => setDate(e.target.value)} disabled={busy} /></label></div>
    <input hidden ref={upload} type="file" accept="image/*" aria-label="미용 사진 파일" onChange={e => void add(e.target.files?.[0])} /><input hidden ref={camera} type="file" accept="image/*" capture="environment" aria-label="카메라 촬영 파일" onChange={e => void add(e.target.files?.[0])} />
    <div className="album-actions"><button type="button" className="btn btn-primary" disabled={busy || photos.length >= 6 || !date} onClick={() => upload.current?.click()}><ImagePlus size={17} />{busy ? '사진 저장 중…' : '사진 올리기'}</button><button type="button" className="btn btn-secondary" disabled={busy || photos.length >= 6 || !date} onClick={() => camera.current?.click()}><Camera size={17} />촬영</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {viewing && createPortal(<Modal title={viewing.caption || `${pet.name}의 미용 사진`} description={viewing.date} onClose={() => setViewing(null)} className="photo-lightbox"><img className="photo-full" src={viewing.src} alt={viewing.caption || pet.name} /><footer className="modal-footer"><a className="btn btn-primary" href={viewing.src} download={`${pet.name}-${viewing.date}.jpg`}>사진 저장</a></footer></Modal>, document.querySelector('.app-shell')!)}
  </section>;
}
