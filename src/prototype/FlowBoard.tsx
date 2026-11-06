import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Checkbox } from '@react-spectrum/s2';
import { screenSpec } from './screen-spec';
import type { Flow } from './flows';
type Point={x:number;y:number};
const layouts:Record<string,Record<string,Point>>={
 pricing:{'price-list':{x:390,y:180},'history':{x:1090,y:180},'price-create':{x:40,y:620},'price-detail':{x:390,y:620},'version':{x:1090,y:620},'price-edit':{x:390,y:1060},'price-delete':{x:740,y:1060},'restore':{x:1090,y:1060},'discard':{x:40,y:1500},'conflict':{x:390,y:1500},'restored':{x:1090,y:1500}},
 visit:{calendar:{x:390,y:180},day:{x:390,y:620},'new-visit':{x:40,y:620},'visit-detail':{x:390,y:1060},'care-edit':{x:40,y:1500},'care-publish':{x:40,y:1940},checkout:{x:740,y:1500},paid:{x:740,y:1940},'cancel-visit':{x:390,y:1500}},
 customer:{home:{x:390,y:180},'public-prices':{x:40,y:620},request:{x:390,y:620},notebook:{x:740,y:620},'request-review':{x:390,y:1060},requested:{x:390,y:1500},notification:{x:740,y:1500}},
 notice:{'notice-list':{x:390,y:180},'notice-new':{x:40,y:620},'notice-detail':{x:390,y:620},'notice-edit':{x:40,y:1060},'notice-delete':{x:740,y:1060}}
};
const width=380,gap=100,fallbackHeight=780;
export function FlowBoard({flow,onOpen}:{flow:Flow;onOpen:(id:string)=>void}){
 const viewport=useRef<HTMLDivElement>(null),canvas=useRef<HTMLDivElement>(null),[scale,setScale]=useState(1),[returns,setReturns]=useState(false),[autoFit,setAutoFit]=useState(()=>matchMedia('(min-width:900px)').matches),[heights,setHeights]=useState<Record<string,number>>({});
 const base=layouts[flow.id]??Object.fromEntries(flow.steps.map((s,i)=>[s.id,{x:i%3,y:Math.floor(i/3)}]));
 const xs=[...new Set(Object.values(base).map(p=>p.x))].sort((a,b)=>a-b),ys=[...new Set(Object.values(base).map(p=>p.y))].sort((a,b)=>a-b);
 const rowHeights=ys.map(y=>Math.max(...flow.steps.filter(s=>base[s.id].y===y).map(s=>heights[s.id]??fallbackHeight)));
 const positions=Object.fromEntries(flow.steps.map(s=>[s.id,{x:40+xs.indexOf(base[s.id].x)*(width+gap),y:148+rowHeights.slice(0,ys.indexOf(base[s.id].y)).reduce((n,h)=>n+h+gap,0)}]));
 const canvasWidth=40+xs.length*(width+gap)-gap+50,canvasHeight=Math.max(...flow.steps.map(s=>positions[s.id].y+(heights[s.id]??fallbackHeight)))+60;
 useLayoutEffect(()=>{const nodes=canvas.current?.querySelectorAll<HTMLElement>('[data-screen-id]');if(!nodes)return;const measure=()=>{const sizes=Object.fromEntries([...nodes].map(node=>[node.dataset.screenId!,node.offsetHeight]));setHeights(old=>Object.entries(sizes).every(([id,h])=>old[id]===h)?old:{...old,...sizes});};measure();const observer=new ResizeObserver(measure);nodes.forEach(node=>observer.observe(node));return()=>observer.disconnect();},[flow.id]);
 useEffect(()=>{const el=viewport.current;if(!el)return;const resize=()=>{if(autoFit)setScale(Math.min(1,(el.clientWidth-24)/canvasWidth));};resize();const observer=new ResizeObserver(resize);observer.observe(el);return()=>observer.disconnect();},[canvasWidth,autoFit,flow.id]);
 const edges=flow.steps.flatMap(s=>s.actions.filter(a=>{const p=positions[s.id],q=positions[a.to];const navigationBack=/^(취소|작성 취소|목록|목록으로|예약 유지|공지 유지|계속 검토|검토 유지|선택 취소)$/.test(a.label)||/돌아가기|돌아오기/.test(a.label);return (!!s.ui&&!navigationBack)||returns||(!s.ui&&(q.y>p.y||q.y===p.y&&flow.steps.findIndex(v=>v.id===a.to)>flow.steps.findIndex(v=>v.id===s.id)));}).map(a=>({from:s.id,to:a.to,label:a.label,back:positions[a.to].y<=positions[s.id].y&&positions[a.to].x<=positions[s.id].x})));
 const rootX=canvasWidth/2-145,rootY=24;
 function connector(from:Point,to:Point,height:number){
  if(to.y>from.y){const x1=from.x+width/2,y1=from.y+height,x2=to.x+width/2,y2=to.y,mid=(y1+y2)/2;return {path:`M ${x1} ${y1} C ${x1} ${mid} ${x2} ${mid} ${x2} ${y2-8}`,x:(x1+x2)/2,y:mid};}
  const right=to.x>from.x,x1=from.x+(right?width:0),x2=to.x+(right?0:width),y1=from.y+height/2,y2=to.y+height/2,mid=(x1+x2)/2;
  return {path:`M ${x1} ${y1} C ${mid} ${y1} ${mid} ${y2} ${x2+(right?-8:8)} ${y2}`,x:mid,y:(y1+y2)/2};
 }
 const entryIds=flow.id==='pricing'?['price-list','history']:[flow.steps[0].id];
 return <section className="flow-board-section" aria-label="전체 화면 흐름보드">
  <div className="flow-board-tools"><div><strong>화면 연결도</strong><span>화면을 클릭하면 크게 볼 수 있어요.</span></div><div className="flow-board-zoom"><Checkbox isSelected={returns} onChange={setReturns}>복귀 경로 표시</Checkbox><Button aria-label="흐름도 축소" variant="secondary" onPress={()=>{setAutoFit(false);setScale(s=>Math.max(.2,s-.15));}}>−</Button><output aria-label="흐름도 배율">{Math.round(scale*100)}%</output><Button aria-label="흐름도 확대" variant="secondary" onPress={()=>{setAutoFit(false);setScale(s=>Math.min(1.5,s+.15));}}>＋</Button><Button variant="secondary" onPress={()=>{setAutoFit(true);if(viewport.current)setScale(Math.min(1,(viewport.current.clientWidth-24)/canvasWidth));}}>너비에 맞추기</Button><Button variant="secondary" onPress={()=>{setAutoFit(false);if(viewport.current)setScale(Math.min(1,(viewport.current.clientWidth-24)/canvasWidth,(viewport.current.clientHeight-24)/canvasHeight));}}>전체 보기</Button><Button variant="secondary" onPress={()=>{setAutoFit(false);setScale(1);}}>100%</Button></div></div>
  <div className="flow-color-legend" aria-label="흐름도 색상 범례"><span className="tone-customer">초록 · 고객 행동</span><span className="tone-owner">파랑 · 사장님 업무</span><span className="tone-system">보라 · 시스템 처리·상태</span><span className="tag-confirm">주황 표시 · 확인·판단</span><span className="tag-error">빨강 표시 · 실패·예외</span></div>
  <div className="flow-board-viewport" ref={viewport} tabIndex={0} aria-label="화면 흐름도 캔버스 · 확대 후 가로세로 스크롤로 이동">
   <div style={{width:canvasWidth*scale,height:canvasHeight*scale}} className="flow-board-space"><div className="flow-board-canvas" ref={canvas} style={{width:canvasWidth,height:canvasHeight,transform:`scale(${scale})`}}>
    <svg className="flow-connectors" width={canvasWidth} height={canvasHeight} aria-hidden="true"><defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#8b9ab1" strokeWidth="1.2"/></marker></defs>
     {entryIds.map(id=>{const target=positions[id],x1=rootX+145,y1=rootY+76,x2=target.x+width/2,y2=target.y;return <g key={id}><path d={`M ${x1} ${y1} C ${x1} ${y1+35} ${x2} ${y2-35} ${x2} ${y2-8}`} markerEnd="url(#flow-arrow)"/><rect x={(x1+x2)/2-24} y={(y1+y2)/2-11} width="48" height="22" rx="11"/><text x={(x1+x2)/2} y={(y1+y2)/2+4}>메뉴</text></g>;})}
     {edges.map((e,i)=>{const c=connector(positions[e.from],positions[e.to],heights[e.from]??fallbackHeight),w=Math.max(55,e.label.length*10+20);return <g key={e.from+e.to+i} className={e.back?'flow-return':''}><path d={c.path} markerEnd="url(#flow-arrow)"/><rect x={c.x-w/2} y={c.y-12} width={w} height="24" rx="12"/><text x={c.x} y={c.y+4}>{e.label}</text></g>;})}
    </svg>
    <div className="flow-root" style={{left:rootX,top:rootY,width:290,height:76}}><strong>{flow.name}</strong><span>{flow.role} · {flow.path}</span></div>
    {flow.steps.map((s,i)=>{const spec=screenSpec(flow,s);return <article key={s.id} data-screen-id={s.id} className={`flow-screen-node text-node tone-${spec.tone}`} style={{left:positions[s.id].x,top:positions[s.id].y,width}}>
      <div className="flow-text-tags"><span>{spec.role}</span><span>{s.kind}</span>{s.kind==='예외'&&<b className="tag-error">실패·예외</b>}{['확인','검토'].includes(s.kind)&&<b className="tag-confirm">확인 필요</b>}</div>
      <h3><a href={`#flow=${flow.id}&screen=${s.id}&mode=modal`} onClick={e=>{e.preventDefault();onOpen(s.id);}} aria-label={`${s.name} 화면 열기`}>{String(i+1).padStart(2,'0')}. {s.name}</a></h3>
      <div className="flow-text-status">{s.future?'확장 설계 · 서비스 구현 전':'기존 구현 기반 · 검토용 화면'}</div>
      <section><h4>목적</h4><p>{s.purpose}</p></section>
      <section><h4>진입 경로</h4><ul>{(spec.incoming.length?spec.incoming:['시나리오 시작 · '+flow.name]).map(v=><li key={v}>{v}</li>)}</ul></section>
      <section><h4>표시·입력 항목</h4>{spec.inputs.length+spec.display.length?<ul>{[...spec.inputs,...spec.display].map((v,k)=><li key={k}>{v}</li>)}</ul>:<p>{s.kind==='목록'?'해당 업무의 등록 내역·상태와 선택·등록 동작':s.kind==='조회'?'선택한 대상의 상세 내용과 연결된 이력':s.kind==='결과'?'처리 결과와 후속 행동 안내':s.kind==='예외'?'실패·제한 원인과 재시도·복귀 경로':'대상 정보와 다음 행동을 결정하기 위한 안내'} · 세부 항목은 화면 미리보기에서 확인</p>}</section>
      <section><h4>처리·검증 규칙</h4><ul>{spec.checks.map((v,k)=><li key={k}>{v}</li>)}</ul></section>
      <section><h4>동작 → 다음 화면·상태</h4><ul className="flow-text-actions">{s.actions.map(a=>{const target=flow.steps.find(t=>t.id===a.to)!;return <li key={a.label}><strong>{a.label}</strong><span>→ {target.name}{target.ui?.status?` · ${target.ui.status}`:''}</span>{target.kind==='예외'&&<em>예외 분기</em>}</li>;})}</ul></section>
      <footer><span>서비스 진입 주소: {flow.path}</span><Button variant="secondary" size="S" onPress={()=>onOpen(s.id)}>화면 미리보기 열기</Button></footer>
    </article>;})}
   </div></div>
  </div><p className="flow-board-caption">실선: 진행 경로 · 점선: 복귀 경로(선택 표시) · 카드: 시나리오 상세 명세 · 제목이나 미리보기 버튼 클릭 시 모달 · 카드의 주소는 해당 업무의 서비스 진입 경로입니다.</p>
 </section>;
}
