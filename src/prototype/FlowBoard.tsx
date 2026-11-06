import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox } from '@react-spectrum/s2';
import type { Flow } from './flows';
type Point={x:number;y:number};
const layouts:Record<string,Record<string,Point>>={
 pricing:{'price-list':{x:390,y:180},'history':{x:1090,y:180},'price-create':{x:40,y:620},'price-detail':{x:390,y:620},'version':{x:1090,y:620},'price-edit':{x:390,y:1060},'price-delete':{x:740,y:1060},'restore':{x:1090,y:1060},'discard':{x:40,y:1500},'conflict':{x:390,y:1500},'restored':{x:1090,y:1500}},
 visit:{calendar:{x:390,y:180},day:{x:390,y:620},'new-visit':{x:40,y:620},'visit-detail':{x:390,y:1060},'care-edit':{x:40,y:1500},'care-publish':{x:40,y:1940},checkout:{x:740,y:1500},paid:{x:740,y:1940},'cancel-visit':{x:390,y:1500}},
 customer:{home:{x:390,y:180},'public-prices':{x:40,y:620},request:{x:390,y:620},notebook:{x:740,y:620},'request-review':{x:390,y:1060},requested:{x:390,y:1500},notification:{x:740,y:1500}},
 notice:{'notice-list':{x:390,y:180},'notice-new':{x:40,y:620},'notice-detail':{x:390,y:620},'notice-edit':{x:40,y:1060},'notice-delete':{x:740,y:1060}}
};
const width=290,height=350;
export function FlowBoard({flow,onOpen}:{flow:Flow;onOpen:(id:string)=>void}){
 const viewport=useRef<HTMLDivElement>(null),[scale,setScale]=useState(.7),[returns,setReturns]=useState(false),[autoFit,setAutoFit]=useState(true);
 const positions=layouts[flow.id]??Object.fromEntries(flow.steps.map((s,i)=>[s.id,{x:40+(i%3)*350,y:180+Math.floor(i/3)*440}])),canvasWidth=Math.max(...Object.values(positions).map(p=>p.x))+width+50,canvasHeight=Math.max(...Object.values(positions).map(p=>p.y))+height+60;
 useEffect(()=>{const el=viewport.current;if(!el)return;const resize=()=>{if(autoFit)setScale(Math.min(1,(el.clientWidth-24)/canvasWidth));};resize();const observer=new ResizeObserver(resize);observer.observe(el);return()=>observer.disconnect();},[canvasWidth,autoFit,flow.id]);
 const edges=flow.steps.flatMap(s=>s.actions.filter(a=>{const p=positions[s.id],q=positions[a.to];const navigationBack=/^(취소|작성 취소|목록|목록으로|예약 유지|공지 유지|계속 검토|검토 유지|선택 취소)$/.test(a.label)||/돌아가기|돌아오기/.test(a.label);return (!!s.ui&&!navigationBack)||returns||(!s.ui&&(q.y>p.y||q.y===p.y&&flow.steps.findIndex(v=>v.id===a.to)>flow.steps.findIndex(v=>v.id===s.id)));}).map(a=>({from:s.id,to:a.to,label:a.label,back:positions[a.to].y<=positions[s.id].y&&positions[a.to].x<=positions[s.id].x})));
 const rootX=canvasWidth/2-145,rootY=24;
 function connector(from:Point,to:Point){
  if(to.y>from.y){const x1=from.x+width/2,y1=from.y+height,x2=to.x+width/2,y2=to.y,mid=(y1+y2)/2;return {path:`M ${x1} ${y1} C ${x1} ${mid} ${x2} ${mid} ${x2} ${y2-8}`,x:(x1+x2)/2,y:mid};}
  const right=to.x>from.x,x1=from.x+(right?width:0),x2=to.x+(right?0:width),y1=from.y+height/2,y2=to.y+height/2,mid=(x1+x2)/2;
  return {path:`M ${x1} ${y1} C ${mid} ${y1} ${mid} ${y2} ${x2+(right?-8:8)} ${y2}`,x:mid,y:(y1+y2)/2};
 }
 const entryIds=flow.id==='pricing'?['price-list','history']:[flow.steps[0].id];
 return <section className="flow-board-section" aria-label="전체 화면 흐름보드">
  <div className="flow-board-tools"><div><strong>화면 연결도</strong><span>화면을 클릭하면 크게 볼 수 있어요.</span></div><div className="flow-board-zoom"><Checkbox isSelected={returns} onChange={setReturns}>복귀 경로 표시</Checkbox><Button aria-label="흐름도 축소" variant="secondary" onPress={()=>{setAutoFit(false);setScale(s=>Math.max(.2,s-.15));}}>−</Button><output aria-label="흐름도 배율">{Math.round(scale*100)}%</output><Button aria-label="흐름도 확대" variant="secondary" onPress={()=>{setAutoFit(false);setScale(s=>Math.min(1.5,s+.15));}}>＋</Button><Button variant="secondary" onPress={()=>{setAutoFit(true);if(viewport.current)setScale(Math.min(1,(viewport.current.clientWidth-24)/canvasWidth));}}>너비에 맞추기</Button><Button variant="secondary" onPress={()=>{setAutoFit(false);if(viewport.current)setScale(Math.min(1,(viewport.current.clientWidth-24)/canvasWidth,(viewport.current.clientHeight-24)/canvasHeight));}}>전체 보기</Button><Button variant="secondary" onPress={()=>{setAutoFit(false);setScale(1);}}>100%</Button></div></div>
  <div className="flow-board-viewport" ref={viewport} tabIndex={0} aria-label="화면 흐름도 캔버스 · 확대 후 가로세로 스크롤로 이동">
   <div style={{width:canvasWidth*scale,height:canvasHeight*scale}} className="flow-board-space"><div className="flow-board-canvas" style={{width:canvasWidth,height:canvasHeight,transform:`scale(${scale})`}}>
    <svg className="flow-connectors" width={canvasWidth} height={canvasHeight} aria-hidden="true"><defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#8b9ab1" strokeWidth="1.2"/></marker></defs>
     {entryIds.map(id=>{const target=positions[id],x1=rootX+145,y1=rootY+76,x2=target.x+145,y2=target.y;return <g key={id}><path d={`M ${x1} ${y1} C ${x1} ${y1+35} ${x2} ${y2-35} ${x2} ${y2-8}`} markerEnd="url(#flow-arrow)"/><rect x={(x1+x2)/2-24} y={(y1+y2)/2-11} width="48" height="22" rx="11"/><text x={(x1+x2)/2} y={(y1+y2)/2+4}>메뉴</text></g>;})}
     {edges.map((e,i)=>{const c=connector(positions[e.from],positions[e.to]),w=Math.max(55,e.label.length*10+20);return <g key={e.from+e.to+i} className={e.back?'flow-return':''}><path d={c.path} markerEnd="url(#flow-arrow)"/><rect x={c.x-w/2} y={c.y-12} width={w} height="24" rx="12"/><text x={c.x} y={c.y+4}>{e.label}</text></g>;})}
    </svg>
    <div className="flow-root" style={{left:rootX,top:rootY,width:290,height:76}}><strong>{flow.name}</strong><span>{flow.role} · {flow.path}</span></div>
    {flow.steps.map((s,i)=><article key={s.id} className={`flow-screen-node ${(s.actor??flow.role)==='고객'?'customer-node':''} ${s.future?'future-node':''}`} style={{left:positions[s.id].x,top:positions[s.id].y,width,height}}>
      <a className="flow-screenshot-link" href={`#flow=${flow.id}&screen=${s.id}&mode=play`} onClick={e=>{e.preventDefault();onOpen(s.id);}} aria-label={`${s.name} 화면 열기`}><img src={`screens/${s.id}.jpg`} alt={`${s.name} 화면 미리보기`} loading="lazy"/></a>
      <div className="flow-screen-title"><h3>{s.name}</h3><span>{s.actor??flow.role} · {s.kind}</span></div><code>{flow.id.toUpperCase()}-{String(i+1).padStart(2,'0')} · {s.id}</code><a className="flow-screen-url" href={`#flow=${flow.id}&screen=${s.id}&mode=play`} onClick={e=>{e.preventDefault();onOpen(s.id);}}>{flow.path} · {s.name}</a><p>{s.purpose}</p><footer>{s.future?'미구현 · 검토 제안':s.rule}</footer>
    </article>)}
   </div></div>
  </div><p className="flow-board-caption">실선: 진행 경로 · 점선: 복귀 경로(선택 표시) · 썸네일: 화면 흐름 확인용 프로토타입 · 카드의 주소는 해당 업무의 서비스 진입 경로입니다.</p>
 </section>;
}
