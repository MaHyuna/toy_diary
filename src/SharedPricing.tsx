import { useEffect, useState } from 'react';
import { Button, ButtonGroup, Cell, Column, Content, Dialog, DialogContainer, Heading, LinkButton, Row, TableBody, TableHeader, TableView, Text, TextField } from '@react-spectrum/s2';
import { SpectrumSurface } from './ui/SpectrumSurface';
import { SpectrumPriceEditor } from './SpectrumPriceEditor';
import { MobilePriceMenu } from './MobilePriceMenu';
import { MenuBookingSettings } from './MenuBookingSettings';
import { api } from './types';
import { appUrl } from './routes';
import { loadPriceMenu } from './shared-price-menu';
import type { PriceMenu } from './price-menu';
const emptyMenu:PriceMenu={columns:['목욕','부분미용','부분+목욕','전체 클리핑','스포팅','가위컷'],sections:[]};
type Screen='list'|'read'|'preview'|'edit'|'booking';
export function SharedPricing({onDesign}:{onDesign:()=>void}){
 const [baseline,setBaseline]=useState<PriceMenu|null>(null),[menu,setMenu]=useState<PriceMenu|null>(null);
 const [screen,setScreen]=useState<Screen>('list'),[selected,setSelected]=useState(0),[initialSection,setInitialSection]=useState<number|undefined>();
 const [query,setQuery]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[message,setMessage]=useState(''),[retry,setRetry]=useState(0);
 const [confirmation,setConfirmation]=useState<'leave'|'delete'|null>(null);
 useEffect(()=>{let active=true;setLoaded(false);setError('');loadPriceMenu().then(data=>{if(active){const value=data??emptyMenu;setMenu(value);setBaseline(value);setLoaded(true);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[retry]);
 const dirty=JSON.stringify(menu)!==JSON.stringify(baseline);
 const section=baseline?.sections[selected];
 function list(){setMenu(baseline?structuredClone(baseline):null);setScreen('list');setConfirmation(null);setError('');}
 function back(){if(screen==='edit'&&dirty)setConfirmation('leave');else list();}
 function edit(index?:number){setMenu(structuredClone(baseline??emptyMenu));setInitialSection(index);setMessage('');setError('');setScreen('edit');}
 async function save(value=menu){if(busy||!value)return;setBusy(true);setError('');setMessage('');try{const result=await api<PriceMenu>('/price-menu','PUT',value);setMenu(result);setBaseline(result);setScreen('list');setConfirmation(null);setMessage('요금표를 저장했어요. 고객 요금표에 반영됩니다. 기존 예약 금액은 유지됩니다.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const rows=(baseline?.sections??[]).map((s,index)=>({...s,index})).filter(s=>`${s.title} ${s.breeds}`.toLowerCase().includes(query.trim().toLowerCase()));
 return <SpectrumSurface><div className="mongle-workflow mongle-pricing-workflow">
  <header className="mongle-workflow-header"><Heading level={1}>요금 관리</Heading><LinkButton href={appUrl('prices')} target="_blank" variant="secondary">고객 요금표 보기</LinkButton></header>
  {!loaded?<>{error?<Button onPress={()=>setRetry(n=>n+1)}>다시 불러오기</Button>:<p role="status">요금표를 불러오고 있어요.</p>}</>:<>
   {screen!=='list'&&<div><Button variant="secondary" isDisabled={busy} onPress={back}>목록으로</Button></div>}
   {screen==='list'&&<>
    <Text>등록된 요금 분류를 선택해 내용을 확인하세요.</Text>
    <div className="mongle-workflow-actions"><TextField label="요금 분류 검색" placeholder="분류명·견종 검색" value={query} onChange={setQuery}/><Button onPress={()=>edit(-1)} isDisabled={(baseline?.sections.length??0)>=24}>+ 섹션 등록</Button></div>
    {rows.length?<div className="price-management-list"><TableView aria-label="요금 분류 목록" density="spacious" overflowMode="wrap" onAction={key=>{setSelected(Number(key));setScreen('read');setMessage('');}} UNSAFE_style={{width:'100%',height:'100%'}}><TableHeader><Column isRowHeader>요금 분류</Column><Column width={95}>구성</Column></TableHeader><TableBody>{rows.map(s=><Row id={s.index} key={s.index} textValue={s.title}><Cell>{s.title}<br/><Text>{s.breeds}</Text></Cell><Cell>{s.rows.length>0?`체중 ${s.rows.length}행`:''}{s.rows.length>0&&s.items.length>0?<br/>:null}{s.items.length>0?`항목 ${s.items.length}개`:''}{!s.rows.length&&!s.items.length?'안내문':''}</Cell></Row>)}</TableBody></TableView></div>:<Text>{query?'검색 결과가 없습니다.':'등록된 요금 분류가 없습니다. 섹션 등록으로 첫 요금을 작성하세요.'}</Text>}
    <div className="price-section-actions"><Button variant="secondary" isDisabled={!baseline?.sections.length} onPress={()=>setScreen('preview')}>전체 요금표 보기</Button><Button variant="secondary" isDisabled={!baseline?.sections.length} onPress={()=>edit()}>요금표 수정</Button><Button variant="secondary" isDisabled={!baseline?.sections.length} onPress={onDesign}>요금표 디자인 편집</Button><Button variant="secondary" isDisabled={!baseline?.sections.length} onPress={()=>setScreen('booking')}>예약 요금 연결 관리</Button></div>
   </>}
   {screen==='read'&&section&&baseline&&<><div className="price-section-actions"><Button onPress={()=>edit(selected)}>분류 수정</Button><Button variant="negative" fillStyle="outline" onPress={()=>setConfirmation('delete')}>분류 삭제</Button></div><div className="price-sheet-editor"><MobilePriceMenu menu={{...baseline,sections:[section]}}/></div></>}
   {screen==='preview'&&baseline&&<><div><Button onPress={()=>edit()}>요금표 수정</Button></div><div className="price-sheet-editor"><MobilePriceMenu menu={baseline}/></div></>}
   {screen==='edit'&&menu&&<>
    <div className="mongle-workflow-actions price-save-toolbar"><Text>{dirty?'저장하지 않은 변경사항이 있어요.':'수정 후 저장하면 고객 요금표에 반영됩니다.'}</Text><div className="price-section-actions"><Button variant="secondary" isDisabled={busy||!dirty} onPress={()=>{setMenu(structuredClone(baseline!));setError('');}}>변경 되돌리기</Button><Button variant="accent" onPress={()=>void save()} isDisabled={busy||!dirty} isPending={busy}>요금표 저장</Button></div></div>
    <SpectrumPriceEditor menu={menu} initialSection={initialSection} onChange={m=>{setMenu(m);setMessage('');}} disabled={busy}/>
   </>}
   {screen==='booking'&&baseline&&<MenuBookingSettings menu={baseline} disabled={busy}/>}
  </>}
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  <DialogContainer onDismiss={()=>{if(!busy)setConfirmation(null);}}>{confirmation&&<Dialog size="S"><Heading slot="title">{confirmation==='delete'?'요금 분류 삭제':'변경사항을 버릴까요?'}</Heading><Content>{confirmation==='delete'?<Text>‘{section?.title}’ 분류를 고객 요금표에서 삭제합니다. 연결된 새 예약 요금은 사용할 수 없게 되며, 기존 예약·결제 기록은 유지됩니다.</Text>:<Text>저장하지 않은 변경사항을 버리고 목록으로 돌아갑니다.</Text>}{error&&<p role="alert">{error}</p>}</Content><ButtonGroup><Button variant="secondary" isDisabled={busy} onPress={()=>setConfirmation(null)}>취소</Button><Button variant="negative" isDisabled={busy} isPending={busy} onPress={()=>confirmation==='leave'?list():void save({...baseline!,sections:baseline!.sections.filter((_,i)=>i!==selected)})}>{confirmation==='delete'?'삭제 확인':'변경 버리고 목록으로'}</Button></ButtonGroup></Dialog>}</DialogContainer>
 </div></SpectrumSurface>;
}
