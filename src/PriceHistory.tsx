import { useEffect, useState } from 'react';
import { Button, ButtonGroup, Cell, Column, Content, Dialog, DialogContainer, Heading, Row, TableBody, TableHeader, TableView, Text, TextField } from '@react-spectrum/s2';
import { api } from './types';
import { MobilePriceMenu } from './MobilePriceMenu';
import { priceChanges, revisionLabel } from './price-history';
import type { PriceHistoryPage, PriceMenuState, PriceRevision } from './price-history';
const date=(value:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export function PriceHistory({onRestored}:{onRestored:(state:PriceMenuState)=>void}){
 const [page,setPage]=useState<PriceHistoryPage|null>(null),[offset,setOffset]=useState(0),[retry,setRetry]=useState(0);
 const [selected,setSelected]=useState<PriceRevision|null>(null),[previous,setPrevious]=useState<PriceRevision|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [confirm,setConfirm]=useState<PriceMenuState|null>(null),[busy,setBusy]=useState(false),[note,setNote]=useState('');
 useEffect(()=>{let active=true;setPage(null);setError('');api<PriceHistoryPage>(`/price-menu/history?offset=${offset}`).then(value=>{if(active)setPage(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[offset,retry]);
 async function open(version:number){if(loading)return;setLoading(true);setError('');try{const values=await Promise.all([api<PriceRevision>(`/price-menu/history/${version}`),version>1?api<PriceRevision>(`/price-menu/history/${version-1}`):Promise.resolve(null)]);setSelected(values[0]);setPrevious(values[1]);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 async function prepare(){setBusy(true);setError('');try{setConfirm(await api<PriceMenuState>('/price-menu/state'));setNote('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function restore(){if(!selected||!confirm||busy)return;setBusy(true);setError('');try{const result=await api<PriceMenuState>(`/price-menu/history/${selected.version}/restore`,'POST',{expectedVersion:confirm.version,note});setConfirm(null);onRestored(result);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const changes=selected&&previous&&selected.kind!=='baseline'?priceChanges(previous.menu,selected.menu):[];
 const restoreChanges=selected&&confirm?priceChanges(confirm.menu,selected.menu):[];
 return <section className="mongle-workflow-stack" aria-label="요금표 변경 이력"><Heading level={2}>요금표 변경 이력</Heading>
 <Text>저장 시각은 한국 시간입니다. 기존 저장본의 시각은 이력 보존을 시작한 시점이며, 최초 작성일이 아닙니다.</Text>
 {!selected?<>{page? <>{page.entries.length?<div className="price-management-list"><TableView aria-label="요금표 버전 목록" overflowMode="wrap" density="spacious" onAction={key=>void open(Number(key))} UNSAFE_style={{height:'100%',width:'100%'}}><TableHeader><Column isRowHeader>버전 · 변경 내용</Column><Column width={125}>기록 시각</Column></TableHeader><TableBody>{page.entries.map(r=><Row key={r.version} id={r.version} textValue={`v${r.version}`}><Cell>v{r.version}{r.version===page.currentVersion?' · 현재 적용':''}<br/>{revisionLabel(r)}{r.note&&<><br/>{r.note}</>}</Cell><Cell>{date(r.savedAt)}</Cell></Row>)}</TableBody></TableView></div>:<Text>저장된 이력이 없습니다. 요금표를 처음 저장하면 이력이 시작됩니다.</Text>}
 <div className="mongle-workflow-actions"><Button variant="secondary" isDisabled={offset===0||loading} onPress={()=>setOffset(n=>Math.max(0,n-20))}>이전 이력 페이지</Button><Text>{page.total}개 버전</Text><Button variant="secondary" isDisabled={offset+20>=page.total||loading} onPress={()=>setOffset(n=>n+20)}>다음 이력 페이지</Button></div></>:!error&&<p role="status">이력을 불러오고 있어요.</p>}{loading&&<p role="status">버전 내용을 불러오고 있어요.</p>}</>:<>
 <div className="mongle-workflow-actions"><Button variant="secondary" isDisabled={busy} onPress={()=>{setSelected(null);setError('');}}>이력 목록</Button><Button isDisabled={busy||selected.version===page?.currentVersion} onPress={()=>void prepare()}>이 버전으로 복원</Button></div>
 <Heading level={3}>v{selected.version} · {revisionLabel(selected)}</Heading><Text>{date(selected.savedAt)}{selected.note?` · ${selected.note}`:''}</Text>
 {selected.kind==='baseline'?<Text>이력 시작 전 변경 내용은 남아 있지 않습니다. 아래는 보존을 시작한 시점의 저장본입니다.</Text>:!previous?<Text>처음 저장한 요금표입니다. 아래에서 당시 전체 내용을 확인할 수 있습니다.</Text>:<><Heading level={3}>직전 버전과 달라진 내용 · {changes.length}건</Heading><ChangeList changes={changes}/></>}
 <div className="price-sheet-editor"><MobilePriceMenu menu={selected.menu}/></div>
 </>}
 {error&&<div role="alert">{error}{!confirm&&<Button variant="secondary" onPress={()=>setRetry(n=>n+1)}>이력 다시 불러오기</Button>}</div>}
 <DialogContainer onDismiss={()=>{if(!busy)setConfirm(null);}}>{confirm&&selected&&<Dialog size="L"><Heading slot="title">v{selected.version} 요금표로 복원할까요?</Heading><Content><div className="mongle-workflow-stack"><Text>현재 v{confirm.version}에서 아래 내용이 변경됩니다. 고객 요금표와 새 예약 견적에 적용되며, 기존 예약·결제 금액은 유지됩니다. 이력은 삭제되지 않고 새 복원 버전이 추가됩니다. 이미지 디자인과 예약 시간·체중 연결 설정은 복원 대상이 아닙니다.</Text><ChangeList changes={restoreChanges}/><TextField label="복원 사유 (선택)" value={note} onChange={setNote} maxLength={500} isDisabled={busy}/>{error&&<p role="alert">{error}</p>}</div></Content><ButtonGroup><Button variant="secondary" isDisabled={busy} onPress={()=>{setConfirm(null);setError('');}}>취소</Button><Button variant="accent" isDisabled={busy} isPending={busy} onPress={()=>void restore()}>복원 확정</Button></ButtonGroup></Dialog>}</DialogContainer>
 </section>;
}
function ChangeList({changes}:{changes:ReturnType<typeof priceChanges>}){return changes.length?<div className="price-history-changes"><TableView aria-label="요금표 변경 내용" density="compact" overflowMode="wrap" UNSAFE_style={{height:'100%',width:'100%'}}><TableHeader><Column isRowHeader>항목</Column><Column>이전</Column><Column>이후</Column></TableHeader><TableBody>{changes.map(c=><Row key={c.key} id={c.key}><Cell>{c.label}</Cell><Cell>{c.before||'(빈칸)'}</Cell><Cell>{c.after||'(빈칸)'}</Cell></Row>)}</TableBody></TableView></div>:<Text>요금표 내용은 동일합니다.</Text>;}
