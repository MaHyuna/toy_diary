import { useEffect, useState } from 'react';
import { Button, NumberField, Picker, PickerItem, TableView, TableHeader, TableBody, Column, Row, Cell, Heading, Text, Divider } from '@react-spectrum/s2';
import type { PriceMenu } from './price-menu';
import { fixedMenuPrice, menuSources, sourceIdentity, matchesSource } from './menu-booking';
import type { BookingRule } from './menu-booking';
import { api, money } from './types';
export function MenuBookingSettings({menu,disabled}:{menu:PriceMenu;disabled:boolean}) {
 const [rules,setRules]=useState<BookingRule[]>([]),[ready,setReady]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [editing,setEditing]=useState(false),[editingId,setEditingId]=useState<string|null>(null);
 const [selected,setSelected]=useState(''),[min,setMin]=useState(0),[max,setMax]=useState(4),[duration,setDuration]=useState(60);
 const sources=menuSources(menu),source=sources.find(s=>s.id===selected);
 const validRule=(r:BookingRule)=>sources.some(s=>matchesSource(s,r.source)&&fixedMenuPrice(s.value)!==null);
 const unavailable=rules.filter(r=>!validRule(r));
 useEffect(()=>{let active=true;api<{rules:BookingRule[]}>('/menu-booking').then(d=>{if(active){setRules(d.rules);setReady(true);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 async function save(next:BookingRule[]){if(busy||disabled)return;setBusy(true);setError('');setMessage('');try{const saved=await api<{rules:BookingRule[]}>('/menu-booking','PUT',{rules:next});setRules(saved.rules);setEditing(false);setEditingId(null);setMessage('예약에 사용할 요금 항목을 저장했어요.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="mongle-workflow-stack" aria-label="예약 요금 연결"><Divider/><Heading level={2}>예약 요금 연결</Heading><Text>금액은 위 요금표에서 읽습니다. 체중 범위와 소요 시간을 확인한 항목만 고객이 예약할 수 있어요. 상담·복수 금액은 자동 견적에 사용하지 않습니다.</Text>{disabled&&<p role="status">먼저 변경한 요금표를 저장해 주세요.</p>}
 {!editing&&<div><Button isDisabled={disabled||busy||!ready} onPress={()=>{setSelected('');setMin(0);setMax(4);setDuration(60);setEditingId(null);setEditing(true);}}>예약 항목 등록</Button></div>}
 {editing&&<><div className="mongle-workflow-fields"><div className="mongle-workflow-wide"><Picker label="예약에 사용할 요금표 항목" selectedKey={selected||null} onSelectionChange={key=>setSelected(String(key))} isDisabled={disabled||busy||!ready}>{sources.filter(s=>fixedMenuPrice(s.value)!==null).map(s=><PickerItem key={s.id} id={s.id}>{s.group} · {s.service} · {s.band||'공통'} · {money(fixedMenuPrice(s.value)!)}원</PickerItem>)}</Picker></div>
 <NumberField label="최소 체중 (kg, 이상)" value={min} onChange={setMin} minValue={0} maxValue={150} step={0.1} isDisabled={disabled||busy}/><NumberField label="최대 체중 (kg, 미만)" description="150kg만 이하로 포함됩니다." value={max} onChange={setMax} minValue={0.1} maxValue={150} step={0.1} isDisabled={disabled||busy}/><NumberField label="소요 시간 (분)" value={duration} onChange={setDuration} minValue={10} maxValue={480} step={10} isDisabled={disabled||busy}/></div>
 <div><Button onPress={()=>source&&save([...rules.filter(r=>r.source.id!==editingId),{source:sourceIdentity(source),minWeight:min,maxWeight:max,duration}])} isDisabled={!source||!ready||disabled||busy} isPending={busy}>예약 항목 연결</Button><Button variant="secondary" isDisabled={busy} onPress={()=>setEditing(false)}>작성 취소</Button></div></>}
 {unavailable.length>0&&<><p role="status">요금표 변경으로 {unavailable.length}개 연결을 사용할 수 없습니다. 해제 후 해당 항목을 다시 연결해 주세요.</p><div><Button variant="secondary" isDisabled={disabled||busy} onPress={()=>save(rules.filter(validRule))}>사용 불가 연결 해제</Button></div></>}
 {ready&&rules.length>0&&<div className="mongle-rule-table"><TableView aria-label="연결된 예약 요금" density="compact" overflowMode="wrap" UNSAFE_style={{height:'100%',width:'100%'}}><TableHeader><Column isRowHeader>요금 항목·체중·시간</Column><Column width={135}>관리</Column></TableHeader><TableBody>{rules.map(r=><Row key={r.source.id} id={r.source.id}><Cell>{r.source.group} · {r.source.service} · {r.source.band||'공통'}<br/>{r.minWeight}–{r.maxWeight}kg · {r.duration}분</Cell><Cell><Button variant="secondary" size="S" isDisabled={busy||disabled} onPress={()=>{setSelected(r.source.id);setMin(r.minWeight);setMax(r.maxWeight);setDuration(r.duration);setEditingId(r.source.id);setEditing(true);}}>수정</Button><Button variant="secondary" size="S" aria-label={`${r.source.group} ${r.source.service} ${r.source.band} 연결 해제`} isDisabled={busy||disabled} onPress={()=>save(rules.filter(v=>v.source.id!==r.source.id))}>해제</Button></Cell></Row>)}</TableBody></TableView></div>}
 {ready&&!rules.length&&<Text>연결된 항목이 없습니다. 고객 온라인 예약은 준비 중으로 표시됩니다.</Text>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</section>;
}
