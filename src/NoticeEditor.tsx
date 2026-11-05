import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from './types';
import type { ShopNotice } from './types';
import { Modal } from './Forms';
import './notebook.css';

export function NoticeEditor({onClose}: {onClose:()=>void}) {
  const [items, setItems] = useState<ShopNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; setLoading(true); setError(''); api<ShopNotice[]>('/notices').then(data=>{if(active){setItems(data);setLoaded(true);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);}); return()=>{active=false;}; }, [retry]);
  function edit(id: string, patch: Partial<ShopNotice>) {setItems(rows=>rows.map(row=>row.id===id?{...row,...patch}:row));setSaved('');}
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true);setError('');setSaved('');
    try {const data=await api<ShopNotice[]>('/notices','PUT',{notices:items});setItems(data);setSaved('공지사항을 저장했어요. 공개를 선택한 공지는 고객 수첩에 표시됩니다.');}
    catch(e){setError(e instanceof Error?e.message:'공지사항을 저장하지 못했어요.');}
    finally{setBusy(false);}
  }
  return <Modal busy={busy} title="고객 공지 관리" description="휴무·예약 변경 안내 등을 작성하세요. 공개를 선택하고 저장하면 모든 고객에게 보입니다." onClose={onClose}>
    {loading ? <p role="status">공지를 불러오고 있어요…</p> : <form className="notice-editor" onSubmit={save}>
      {error&&<p role="alert" className="form-error">{error}</p>}
      {error&&!loaded&&<button type="button" onClick={()=>setRetry(n=>n+1)}>다시 불러오기</button>}
      {items.map((notice,index)=><fieldset key={notice.id} disabled={busy}><legend>공지 {index+1}</legend><label>제목<input required maxLength={80} value={notice.title} onChange={e=>edit(notice.id,{title:e.target.value})}/></label><label>내용<textarea required maxLength={2000} rows={4} value={notice.body} onChange={e=>edit(notice.id,{body:e.target.value})}/></label><div><label className="notice-publish"><input type="checkbox" checked={notice.published} onChange={e=>edit(notice.id,{published:e.target.checked})}/>고객에게 공개</label><button type="button" className="text-button" aria-label={`공지 ${index+1} 삭제`} onClick={()=>{setItems(rows=>rows.filter(row=>row.id!==notice.id));setSaved('');}}><Trash2 size={17}/></button></div></fieldset>)}
      <button type="button" className="btn btn-secondary" disabled={busy||items.length>=20||!!error&&!loaded} onClick={()=>{setItems(rows=>[...rows,{id:crypto.randomUUID(),title:'',body:'',published:false}]);setSaved('');}}><Plus size={17}/>공지 추가</button>
      <p className="notice-save-hint">공개 해제·삭제도 저장을 눌러야 반영됩니다. 고객 이름이나 연락처는 공지에 적지 마세요.</p>
      {saved&&<p role="status">{saved}</p>}
      <footer className="modal-footer"><button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>닫기</button><button type="submit" className="btn btn-primary" disabled={busy||!!error&&!loaded}>{busy?'저장 중…':'공지 저장'}</button></footer>
    </form>}
  </Modal>;
}
