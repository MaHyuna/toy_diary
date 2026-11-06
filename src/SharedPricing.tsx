import { useEffect,useState } from 'react';
import { Button, Heading, LinkButton, Text } from '@react-spectrum/s2';
import { SpectrumSurface } from './ui/SpectrumSurface';
import { SpectrumPriceEditor } from './SpectrumPriceEditor';
import { MenuBookingSettings } from './MenuBookingSettings';
import { api } from './types';
import { appUrl } from './routes';
import { loadPriceMenu } from './shared-price-menu';
import type { PriceMenu } from './price-menu';
export function SharedPricing(){
 const [menu,setMenu]=useState<PriceMenu|null>(null),[saved,setSaved]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;loadPriceMenu().then(data=>{if(active){setMenu(data);api<PriceMenu|null>('/public/price-menu').then(published=>{if(active){setSaved(published?JSON.stringify(data):'');setLoaded(true);}}).catch(e=>{if(active)setError(e.message);});}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 const dirty=JSON.stringify(menu)!==saved;
 async function save(){if(busy||!menu)return;setBusy(true);setError('');setMessage('');try{const result=await api<PriceMenu>('/price-menu','PUT',menu);setMenu(result);setSaved(JSON.stringify(result));setMessage('요금표를 저장했어요. 고객 요금표와 연결된 새 예약 견적에 반영됩니다. 기존 예약 금액은 유지됩니다.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <SpectrumSurface><div className="mongle-workflow mongle-pricing-workflow"><header className="mongle-workflow-header"><Heading level={1}>요금 관리</Heading><LinkButton href={appUrl('prices')} target="_blank" variant="secondary">고객 요금표 보기</LinkButton></header><Text>고객에게 게시할 표를 수정하세요. 예약에 사용할 항목은 아래에서 연결합니다.</Text>{!loaded&&!error?<p role="status">요금표를 불러오고 있어요.</p>:menu?<><SpectrumPriceEditor menu={menu} onChange={m=>{setMenu(m);setMessage('');}} disabled={busy}/><div className="mongle-workflow-actions"><Text>{dirty?'저장하지 않은 변경사항이 있어요.':'저장된 요금표입니다.'}</Text><Button variant="accent" onPress={save} isDisabled={busy||!dirty} isPending={busy}>요금표 저장</Button></div><MenuBookingSettings menu={menu} disabled={dirty||busy}/></>:loaded?<Text>요금표 디자인에서 표를 작성·게시해 주세요.</Text>:null}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</div></SpectrumSurface>;
}
