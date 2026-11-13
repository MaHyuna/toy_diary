import {setSectionFlow} from './price-studio-structure.js?v=decor-27';
import {pairedSections,rowWidths,rowMetrics,setSectionWidth} from './price-studio-layout.js?v=decor-27';
// Desktop properties stay beside the canvas; mobile uses a resizable bottom sheet.
export function createInspector({getProject,getActive,selectSection,setTab,change,reorder}){
 const $=id=>document.getElementById(id),panel=$('studio-inspector'),editor=document.querySelector('.editor'),editorHome=editor.parentNode,editorNext=editor.nextSibling;
 let mode='text',drag=null,lastFocus=null;const status=$('message'),statusHome=document.createComment('status-home');status.before(statusHome);
 const mobile=()=>matchMedia('(max-width:740px)').matches;
 const backdrop=document.createElement('button');backdrop.id='inspector-backdrop';backdrop.type='button';backdrop.hidden=true;backdrop.setAttribute('aria-label','설정창 바깥 배경 닫기');panel.before(backdrop);backdrop.onclick=()=>{close();$('sheet-close').click();};
 const resizeBar=document.createElement('div');resizeBar.className='inspector-resize-bar';
 const grip=document.createElement('button');grip.type='button';grip.id='inspector-resize-handle';grip.setAttribute('role','slider');grip.setAttribute('aria-label','설정창 높이 조절');grip.setAttribute('aria-orientation','vertical');grip.setAttribute('aria-valuemin','30');grip.setAttribute('aria-valuemax','90');grip.title='위아래로 끌어 설정창 높이 조절';grip.innerHTML='<span aria-hidden="true"></span>';
 const expand=document.createElement('button');expand.type='button';expand.id='inspector-expand';resizeBar.append(grip,expand);panel.prepend(resizeBar);
 let heightRatio=.7,resizeDrag=null,suppressGripClick=false;
 try{const stored=Number(localStorage.getItem('price-inspector-height'));if(stored>=.3&&stored<=.9)heightRatio=stored;}catch{}
 const viewportHeight=()=>window.visualViewport?.height||innerHeight;
 function setHeightRatio(value,persist=true){heightRatio=Math.max(.3,Math.min(.9,value));position();if(persist)try{localStorage.setItem('price-inspector-height',String(heightRatio));}catch{}}
 expand.onclick=()=>setHeightRatio(heightRatio>=.85?.7:.9);
 grip.onclick=()=>{if(suppressGripClick){suppressGripClick=false;return;}setHeightRatio(heightRatio>=.85?.7:.9);};
 grip.addEventListener('pointerdown',ev=>{if(!mobile()||ev.button!==0)return;ev.preventDefault();resizeDrag={id:ev.pointerId,startY:ev.clientY,ratio:heightRatio,moved:false};suppressGripClick=false;panel.classList.add('inspector-resizing');grip.setPointerCapture(ev.pointerId);});
 grip.addEventListener('pointermove',ev=>{if(resizeDrag?.id!==ev.pointerId)return;ev.preventDefault();if(Math.abs(ev.clientY-resizeDrag.startY)>4)resizeDrag.moved=true;setHeightRatio(resizeDrag.ratio+(resizeDrag.startY-ev.clientY)/viewportHeight(),false);});
 function endResize(ev,cancel=false){if(resizeDrag?.id!==ev.pointerId)return;const previous=resizeDrag;resizeDrag=null;panel.classList.remove('inspector-resizing');suppressGripClick=previous.moved;if(cancel)setHeightRatio(previous.ratio,false);else setHeightRatio(heightRatio);if(grip.hasPointerCapture(ev.pointerId))grip.releasePointerCapture(ev.pointerId);}
 grip.addEventListener('pointerup',ev=>endResize(ev));grip.addEventListener('pointercancel',ev=>endResize(ev,true));
 grip.addEventListener('keydown',ev=>{const step=ev.shiftKey?.1:.05;const value=ev.key==='ArrowUp'?heightRatio+step:ev.key==='ArrowDown'?heightRatio-step:ev.key==='Home'?.3:ev.key==='End'?.9:null;if(value===null)return;ev.preventDefault();setHeightRatio(value);});
 $('inspector-text').append(document.querySelector('.canvas-tools'),document.querySelector('.spacing-inspector'));
 function restoreEditor(){if(editor.parentNode!==editorHome)editorHome.insertBefore(editor,editorNext);}
 function reveal(){requestAnimationFrame(()=>{const shell=document.querySelector('.canvas-shell'),selected=document.querySelector('.canvas-selection');if(selected){const a=selected.getBoundingClientRect(),b=shell.getBoundingClientRect();shell.scrollTop+=a.top-b.top-(b.height-Math.min(a.height,b.height))/2;}});}
 function open(next='text'){
  const switched=panel.hidden||mode!==next;lastFocus=panel.hidden?document.activeElement:lastFocus;
  $('sheet-close').click();$('view-canvas').click();panel.hidden=false;document.body.classList.add('inspector-open');mode=next;
  for(const el of panel.querySelectorAll('[data-inspector-panel]'))el.hidden=el.dataset.inspectorPanel!==next;
  for(const button of panel.querySelectorAll('[data-inspector-tab]'))button.setAttribute('aria-selected',String(button.dataset.inspectorTab===next));
  if(['design','brand','border'].includes(next)){$('inspector-general').hidden=false;$('inspector-general').append(editor);setTab(next);}else restoreEditor();
  $('inspector-title').textContent={text:'문자 · 색상',design:'전체 꾸미기',brand:'로고 · 매장',layout:'레이아웃',border:'테두리 · 모서리'}[next];
  document.body.dataset.inspector=next;panel.querySelector('.inspector-scroll').prepend(status);if(switched)panel.querySelector('.inspector-scroll').scrollTop=0;position();refresh();reveal();if(mobile())requestAnimationFrame(()=>grip.focus({preventScroll:true}));
 }
 function close(){if(panel.hidden)return;if(resizeDrag){const id=resizeDrag.id;resizeDrag=null;panel.classList.remove('inspector-resizing');if(grip.hasPointerCapture(id))grip.releasePointerCapture(id);}panel.hidden=true;backdrop.hidden=true;panel.setAttribute('aria-modal','false');document.body.classList.remove('inspector-open','inspector-keyboard');document.body.style.removeProperty('--inspector-canvas-height');panel.style.height='';panel.style.bottom='';delete document.body.dataset.inspector;restoreEditor();statusHome.after(status);if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
 function refresh(){
  if(panel.hidden)return;
  if(mode==='layout'&&!drag){
   const p=getProject(),active=getActive();$('layout-list').replaceChildren();
   p.sections.forEach((s,i)=>{
    const row=document.createElement('div');row.className='layout-row'+(s.id===active?' active':'');row.dataset.section=s.id;
    const handle=document.createElement('button');handle.className='layout-drag';handle.dataset.reorder=s.id;handle.textContent='⠿';handle.setAttribute('aria-label',s.title+' 순서 드래그');handle.title='끌어서 순서 이동';
    const name=document.createElement('button');name.className='layout-select';name.textContent=s.title;name.onclick=()=>{selectSection(s.id);reveal();};
    const width=document.createElement('select');width.setAttribute('aria-label',s.title+' 레이아웃 너비');width.add(new Option('전체 너비','full'));width.add(new Option('두 열 · 비율','half'));width.value=p.structure?(pairedSections(p,s.id)?'half':'full'):s.span;width.disabled=s.kind==='matrix';width.onchange=()=>{setSectionFlow(p,s.id,width.value);delete s.layoutWidth;change();};
    const before=document.createElement('button'),after=document.createElement('button');before.textContent='↑';after.textContent='↓';before.setAttribute('aria-label',s.title+' 위로 이동');after.setAttribute('aria-label',s.title+' 아래로 이동');before.disabled=i===0;after.disabled=i===p.sections.length-1;before.onclick=()=>reorder(i,i-1);after.onclick=()=>reorder(i,i+1);
    row.append(handle,name,width,before,after);$('layout-list').append(row);
   });
   const visible=p.sections.filter(s=>s.visible),pairedIds=new Set();for(let i=0;i<visible.length-1;i++)if(visible[i].span==='half'&&visible[i+1].span==='half'&&visible[i].kind!=='matrix'&&visible[i+1].kind!=='matrix'){pairedIds.add(visible[i].id);pairedIds.add(visible[++i].id);}const s=p.sections.find(s=>s.id===active),paired=pairedIds.has(s?.id);
   const pair=s&&pairedSections(p,s.id);$('section-ratio-settings').hidden=!pair;
   if(pair){const widths=rowWidths(p,...pair),index=pair[0].id===s.id?0:1,m=rowMetrics(p,s.id),percent=widths[index]/m.available*100;for(const id of ['section-ratio','section-ratio-number']){const input=$(id);input.min=String(Math.ceil(m.min/m.available*1000)/10);input.max=String(Math.floor((m.max??m.available-m.min)/m.available*1000)/10);if(input!==document.activeElement)input.value=String(Math.round(percent*10)/10);}$('section-ratio-summary').textContent=s.title+' '+Math.round(percent)+'% · '+pair[1-index].title+' '+Math.round(100-percent)+'%'+(s.layoutWidth===undefined?' · 선택한 섹션이 남은 공간을 채워요.':' · 옆 섹션이 남은 공간을 채워요.');}
   $('layout-active-name').textContent=s?.title||'섹션을 선택해 주세요';
   $('section-position').disabled=!s||s.span!=='half'||paired;$('section-position').value=s?.layoutAlign||'left';
  }
  // Inputs are shared with the original editor; update values without stealing focus.
  panel.querySelectorAll('[data-design]').forEach(input=>{if(document.activeElement!==input&&input.type!=='checkbox'&&getProject().design[input.dataset.design]!==undefined)input.value=getProject().design[input.dataset.design];});
 }
 function toggle(next){if(!panel.hidden&&mode===next)close();else open(next);}
 $('inspector-close').onclick=close;
 panel.querySelectorAll('[data-inspector-tab]').forEach(button=>button.onclick=()=>open(button.dataset.inspectorTab));
 document.querySelectorAll('[data-open-inspector]').forEach(button=>button.onclick=()=>toggle(button.dataset.openInspector));
 for(const id of ['section-ratio','section-ratio-number'])$(id).oninput=ev=>{const el=ev.target;if(el.value===''||!el.validity.valid)return;const p=getProject();setSectionWidth(p,getActive(),rowMetrics(p,getActive()).available*Number(el.value)/100);change(false);};
 $('section-fill').onclick=()=>{const p=getProject(),pair=pairedSections(p,getActive());if(!pair)return;const widths=rowWidths(p,...pair),index=pair[0].id===getActive()?0:1;pair[1-index].layoutWidth=widths[1-index];delete pair[index].layoutWidth;change(false);};
 $('section-equal').onclick=()=>{const pair=pairedSections(getProject(),getActive());if(pair){pair.forEach(s=>delete s.layoutWidth);change(false);}};
 $('section-position').onchange=()=>{const s=getProject().sections.find(s=>s.id===getActive());if(s){s.layoutAlign=$('section-position').value;change();}};
 for(const button of panel.querySelectorAll('[data-layout-preset]'))button.onclick=()=>{delete getProject().structure;for(const s of getProject().sections){s.span=button.dataset.layoutPreset==='columns'&&s.kind!=='matrix'?'half':'full';delete s.layoutWidth;}change();};
 $('layout-even-gaps').onclick=()=>{getProject().design.gap=24;getProject().design.columnGap=24;change();};
 // Stable pointer capture supports touch reordering without rebuilding the list mid-drag.
 panel.addEventListener('pointerdown',ev=>{const handle=ev.target.closest('[data-reorder]');if(!handle)return;ev.preventDefault();drag={pointer:ev.pointerId,id:handle.dataset.reorder,to:null};panel.setPointerCapture(ev.pointerId);handle.closest('.layout-row').classList.add('dragging');});
 panel.addEventListener('pointermove',ev=>{if(drag?.pointer!==ev.pointerId)return;ev.preventDefault();const rows=[...$('layout-list').children];let target=rows.find(row=>{const r=row.getBoundingClientRect();return ev.clientY>=r.top&&ev.clientY<=r.bottom;});if(!target)return;drag.to=rows.indexOf(target);for(const row of rows)row.classList.toggle('drop-target',row===target);});
 function endDrag(ev,cancel=false){if(drag?.pointer!==ev.pointerId)return;const previous=drag;drag=null;if(panel.hasPointerCapture(ev.pointerId))panel.releasePointerCapture(ev.pointerId);if(!cancel&&previous.to!==null){const from=getProject().sections.findIndex(s=>s.id===previous.id);reorder(from,previous.to);}refresh();}
 panel.addEventListener('pointerup',ev=>endDrag(ev));panel.addEventListener('pointercancel',ev=>endDrag(ev,true));
 panel.addEventListener('keydown',ev=>{if(ev.key!=='Tab'||!mobile()||panel.hidden)return;const controls=[...panel.querySelectorAll('button,input,select,textarea,[tabindex]')].filter(node=>!node.disabled&&node.tabIndex>=0&&node.getClientRects().length);if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}});
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!panel.hidden&&!document.querySelector('dialog[open]')){ev.preventDefault();close();}});
 // Dismiss on a deliberate blank-space tap, not canvas selection or scrolling.
 let outsideTap=null;
 document.addEventListener('pointerdown',ev=>{
  const interactive=ev.composedPath().some(node=>node instanceof Element&&(node===panel||node.matches('button,input,select,textarea,label,a,[role="button"],.canvas-hit,.canvas-input')));
  outsideTap=!panel.hidden&&!interactive&&!document.querySelector('dialog[open]')?{id:ev.pointerId,x:ev.clientX,y:ev.clientY,moved:false}:null;
 },true);
 document.addEventListener('pointermove',ev=>{if(outsideTap?.id===ev.pointerId&&Math.hypot(ev.clientX-outsideTap.x,ev.clientY-outsideTap.y)>8)outsideTap.moved=true;},true);
 document.addEventListener('pointercancel',()=>outsideTap=null,true);
 document.addEventListener('click',ev=>{
  const tap=outsideTap;outsideTap=null;
  if(tap&&!tap.moved&&!panel.hidden&&!panel.contains(ev.target)&&Math.hypot(ev.clientX-tap.x,ev.clientY-tap.y)<=8)close();
 });
 $('view-form').addEventListener('click',close);
 function position(){
  const modal=mobile()&&!panel.hidden;backdrop.hidden=!(mobile()&&(!panel.hidden||!$('mobile-sheet').hidden));panel.setAttribute('aria-modal',String(modal));
  if(!modal){panel.style.height='';panel.style.bottom='';document.body.style.removeProperty('--inspector-canvas-height');document.body.classList.remove('inspector-keyboard');return;}
  const v=window.visualViewport,available=viewportHeight(),inset=Math.max(0,innerHeight-available-(v?.offsetTop||0)),height=Math.round(available*heightRatio);
  panel.style.height=height+'px';panel.style.bottom=inset+'px';document.body.style.setProperty('--inspector-canvas-height',Math.max(40,available-height)+'px');document.body.classList.toggle('inspector-keyboard',inset>100);
  grip.setAttribute('aria-valuenow',String(Math.round(heightRatio*100)));grip.setAttribute('aria-valuetext',Math.round(heightRatio*100)+'%');
  const enlarged=heightRatio>=.85;expand.textContent=enlarged?'70%로 줄이기':'90%로 펼치기';expand.setAttribute('aria-expanded',String(enlarged));
 }

 new MutationObserver(()=>{backdrop.hidden=!(mobile()&&(!panel.hidden||!$('mobile-sheet').hidden));}).observe($('mobile-sheet'),{attributes:true,attributeFilter:['hidden']});
 window.visualViewport?.addEventListener('resize',()=>{position();if(!panel.hidden)reveal();});
 const resize=()=>{position();if(!panel.hidden)reveal();};matchMedia('(max-width:740px)').addEventListener('change',resize);
 return {open,toggle,close,refresh,get mode(){return panel.hidden?null:mode;}};
}
