// Canvas interaction stays in HTML; exported pixels contain only the price poster.
export function createCanvasEditor({getProject,getResult,change,onSection,refreshForm}){
 const $=id=>document.getElementById(id),stage=$('poster-stage'),overlay=$('canvas-overlay');
 let selectedId=null,inline=null,drag=null;
 const element=()=>getResult().elements?.find(e=>e.id===selectedId);
 const layout=()=>{const p=getProject();return p.canvas??=( {transforms:{},styles:{}});};
 const transform=id=>layout().transforms[id]||{x:0,y:0,scale:1};
 const style=()=>layout().styles[selectedId]||{};
 function binding(e){const p=getProject(),b=e.binding,s=p.sections.find(s=>s.id===b.sectionId),r=s?.rows?.find(r=>r.id===b.rowId),j=p.columns.findIndex(c=>c.id===b.columnId);if(b.type==='brand')return [p.brand,b.key,1000];if(b.type==='section')return [s,b.key,b.key==='title'?100:b.key==='breeds'?1000:b.key==='content'?5000:3000];if(b.type==='column')return [p.columns[j],b.key,80];if(b.type==='weight')return [r,'weight',100];if(b.type==='price')return [r.prices,j,20];if(b.type==='item')return [s.items[b.index],b.key,250];return null;}
 function place(node,e){const r=getResult();node.style.left=e.x/r.width*100+'%';node.style.top=e.y/r.height*100+'%';node.style.width=e.width/r.width*100+'%';node.style.height=e.height/r.height*100+'%';}
 function finish(){if(!inline)return;const node=inline;inline=null;node.remove();}
 function select(id,edit=false){finish();selectedId=id;const e=element();if(e?.binding.sectionId)onSection(e.binding.sectionId);else if(e?.binding.type==='brand'||e?.binding.type==='logo')onSection(null);render();if(edit)startEdit();}
 function startEdit(){const e=element();if(!e||!binding(e))return;finish();const [obj,key,max]=binding(e);inline=document.createElement('textarea');inline.className='canvas-input';inline.setAttribute('aria-label',e.label+' 직접 입력');inline.maxLength=max;inline.value=obj[key];inline.spellcheck=false;if(e.binding.type==='price')inline.inputMode='numeric';place(inline,e);stage.append(inline);inline.style.fontSize=Math.max(13,(style().fontSize||e.textStyle?.fontSize||16)*stage.clientWidth/900)+'px';inline.style.color=style().color||e.textStyle?.color||'#302c32';inline.addEventListener('input',()=>{obj[key]=inline.value;change(false);});inline.addEventListener('keydown',ev=>{if(ev.isComposing)return;if(ev.key==='Escape'||(ev.key==='Enter'&&!ev.shiftKey)){ev.preventDefault();finish();render();}});inline.addEventListener('blur',finish);inline.focus();inline.select();}
 function render(){const result=getResult();if(!result.elements)return;overlay.replaceChildren();for(const e of result.elements.filter(e=>e.kind!=='group')){const hit=document.createElement('button');hit.className='canvas-hit';hit.dataset.element=e.id;hit.setAttribute('aria-label',e.label+' 편집');hit.title=e.label;place(hit,e);hit.addEventListener('click',()=>select(e.id,true));overlay.append(hit);}
 const e=element(),text=e?.kind==='text';$('canvas-parent').disabled=!e||e.owners.length<2;$('canvas-clear-style').disabled=!text;$('selection-label').textContent=e?e.label:'금액이나 글자를 눌러 입력하세요';for(const id of ['canvas-edit','canvas-bold','canvas-italic','canvas-underline','canvas-color','canvas-font-size','canvas-align'])$(id).disabled=!text;
 if(e){const st=style();for(const key of ['bold','italic','underline'])$('canvas-'+key).setAttribute('aria-pressed',String(!!st[key]));$('canvas-color').value=st.color||e.textStyle?.color||getProject().design.colors.body;$('canvas-font-size').value=st.fontSize||e.textStyle?.fontSize||'';$('canvas-align').value=st.align||e.textStyle?.align||'left';const frame=document.createElement('div');frame.className='canvas-selection';place(frame,e);const move=document.createElement('button');move.className='canvas-move';move.textContent='⠿ 이동';move.setAttribute('aria-label',e.label+' 이동');move.addEventListener('pointerdown',ev=>beginDrag(ev,'move'));const resize=document.createElement('button');resize.className='canvas-resize';resize.setAttribute('aria-label',e.label+' 크기 조절');resize.addEventListener('pointerdown',ev=>beginDrag(ev,'resize'));frame.append(move,resize);overlay.append(frame);if(inline)place(inline,e);}
 }
 function beginDrag(ev,kind){if(ev.button!==0)return;ev.preventDefault();finish();const e=element();drag={kind,id:ev.pointerId,startX:ev.clientX,startY:ev.clientY,e,initial:{...transform(e.id)},ratio:900/stage.clientWidth};stage.setPointerCapture(ev.pointerId);}
 stage.addEventListener('pointermove',ev=>{if(!drag||drag.id!==ev.pointerId)return;const d=drag,dx=(ev.clientX-d.startX)*d.ratio,dy=(ev.clientY-d.startY)*d.ratio,t={...d.initial};if(d.kind==='move'){t.x+=Math.max(-d.e.x,Math.min(900-d.e.x-d.e.width,dx))/d.e.parentScale;t.y+=Math.max(-d.e.y,dy)/d.e.parentScale;}else{const factor=Math.max(.25/d.initial.scale,Math.min(4/d.initial.scale,(900-d.e.x)/d.e.width,1+Math.max(dx/d.e.width,dy/d.e.height)));t.scale=d.initial.scale*factor;}layout().transforms[d.e.id]=t;change(false,{transient:true});});
 function end(ev,cancel=false){if(!drag||drag.id!==ev.pointerId)return;const d=drag;drag=null;stage.releasePointerCapture(ev.pointerId);if(cancel)layout().transforms[d.e.id]=d.initial;change(false);}
 stage.addEventListener('pointerup',ev=>end(ev));stage.addEventListener('pointercancel',ev=>end(ev,true));
 function setStyle(key,value){if(!element())return;layout().styles[selectedId]={...style(),[key]:value};change(false);}
 for(const key of ['bold','italic','underline'])$('canvas-'+key).onclick=()=>setStyle(key,!style()[key]);
 $('canvas-color').oninput=ev=>setStyle('color',ev.target.value);
 $('canvas-font-size').onchange=ev=>{if(ev.target.value&&ev.target.validity.valid)setStyle('fontSize',Number(ev.target.value));};
 $('canvas-align').onchange=ev=>setStyle('align',ev.target.value);
 $('canvas-edit').onclick=startEdit;
 $('canvas-parent').onclick=()=>{const e=element();if(e?.owners.length>1)select(e.owners.at(-2));};
 $('canvas-clear-style').onclick=()=>{if(selectedId){delete layout().styles[selectedId];change(false);}};
 $('canvas-reset').onclick=()=>{finish();layout().transforms={};change(false);};
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!inline){selectedId=null;render();}});
 for(const mode of ['canvas','form'])$('view-'+mode).onclick=()=>{finish();if(mode==='form')refreshForm();document.querySelector('main').dataset.view=mode;for(const name of ['canvas','form'])$('view-'+name).setAttribute('aria-selected',String(name===mode));};
 return {render,select,finish};
}
