import { useEffect,useState } from 'react';
import { api } from './types';
import { appUrl } from './routes';
import { loadPriceMenu } from './shared-price-menu';
import type { PriceMenu } from './price-menu';
import { MobilePriceMenu } from './MobilePriceMenu';
import './price-poster.css';
import './shared-pricing.css';
export function SharedPricing(){const [menu,setMenu]=useState<PriceMenu|null>(null),[saved,setSaved]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[message,setMessage]=useState('');useEffect(()=>{loadPriceMenu().then(data=>{setMenu(data);setSaved(JSON.stringify(data));setLoaded(true);}).catch(e=>setError(e.message));},[]);const dirty=JSON.stringify(menu)!==saved;
 return <div className="shared-pricing customer-price-page"><div className="shared-pricing-toolbar"><p>고객에게 보이는 표의 금액을 직접 수정하세요.</p><a href={appUrl('prices')} target="_blank" rel="noopener">고객 요금표 보기 ↗</a></div>{!loaded&&!error?<p role="status">요금표를 불러오고 있어요…</p>:menu?<form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');try{const result=await api<PriceMenu>('/price-menu','PUT',menu);setMenu(result);setSaved(JSON.stringify(result));setMessage('같은 요금표로 저장했어요. 고객 화면에도 반영됩니다.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><fieldset disabled={busy}><MobilePriceMenu menu={menu} onChange={data=>{setMenu(data);setMessage('');}}/></fieldset><footer className="shared-pricing-save"><span>{dirty?'변경한 금액을 저장해 주세요.':'저장된 요금표입니다.'}</span><button className="btn btn-primary" disabled={busy||!dirty}>{busy?'저장 중…':'요금표 저장'}</button></footer></form>:loaded?<p>아직 등록된 요금표가 없습니다. 요금표 디자인에서 표를 작성·게시해 주세요.</p>:null}{error&&<p role="alert" className="form-error">{error}</p>}{message&&<p role="status">{message}</p>}</div>;
}
