import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultProject,validateProject,toCSV,fromCSV,moveColumn,moveSection} from '../public/planning/price-studio-data.js';
const semantic=p=>({brand:{...p.brand,logo:''},columns:p.columns.map(({name,note})=>({name,note})),sections:p.sections.map(({style,...s})=>({...s,...(s.rows?{rows:s.rows.map(({id,...r})=>r)}:{})}))});
test('CSV roundtrip preserves all group cells, blank versus zero, multiline, quotes and formula-like text',()=>{const p=createDefaultProject();p.brand.name='=店名,"몽글"\n다음 줄';p.sections[0].title="'=문자 그대로";p.sections[0].rows[0].prices[0]='';p.sections[0].rows[0].prices[1]='0';p.sections[3].items.push({label:'+특수 작업',value:'10,000 / 20,000'});assert.deepEqual(semantic(fromCSV(toCSV(p))),semantic(p));assert.match(toCSV(p),/"'=店名/);});
test('moving a service column preserves its corresponding prices in every breed and weight row',()=>{const p=createDefaultProject();const original=new Map();for(const s of p.sections)if(s.rows)for(const r of s.rows)original.set(r.id,r.prices[0]);const first=p.columns[0].name;moveColumn(p,0,4);assert.equal(p.columns[4].name,first);for(const s of p.sections)if(s.rows)for(const r of s.rows)assert.equal(r.prices[4],original.get(r.id));const id=p.sections[4].id;moveSection(p,4,0);assert.equal(p.sections[0].id,id);assert.doesNotThrow(()=>validateProject(p));});
test('full backup restores custom colors, styles, logo, visibility and ordering',()=>{const p=createDefaultProject();p.brand.logo='data:image/png;base64,aGVsbG8=';p.design.colors.tableHeader='#883344';p.sections[1].style={heading:'#123456',border:'dashed',borderWidth:2,background:'#eeeeee'};p.sections[0].visible=false;moveSection(p,4,0);assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);});
test('malformed imports fail rather than dropping duplicated or missing prices and keep the source untouched',()=>{const p=createDefaultProject(),original=JSON.stringify(p);const csv=toCSV(p),lines=csv.split('\r\n');const price=lines.findIndex(s=>s.startsWith('"price"'));const missing=lines.toSpliced(price,1).join('\r\n');assert.throws(()=>fromCSV(missing),/누락/);assert.throws(()=>fromCSV(csv+'\r\n'+lines[price]),/중복/);assert.throws(()=>fromCSV('arbitrary,csv\n1,2'));assert.throws(()=>validateProject({...p,design:{...p.design,colors:{...p.design.colors,body:'url(bad)'}}}));assert.equal(JSON.stringify(p),original);});

test('canvas backup preserves element transforms and typography and rejects invalid styles', () => {
 const p=createDefaultProject();p.canvas={transforms:{'brand:name':{x:12,y:25,scale:1.2}},styles:{'brand:name':{bold:true,italic:false,underline:true,color:'#aabbcc',fontSize:32,align:'left'}}};
 assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))).canvas,p.canvas);
 const invalid=structuredClone(p);invalid.canvas.styles['brand:name'].fontSize=300;
 assert.throws(()=>validateProject(invalid));
});

test('moving a section carries its price cells while a cell retains its own offset', async () => {
 const {renderPoster}=await import('../public/planning/price-studio-render.js');
 const ctx=new Proxy({measureText:s=>({width:String(s).length*7})},{get:(obj,key)=>key in obj?obj[key]:()=>{}}),canvas={getContext:()=>ctx};
 const p=createDefaultProject(),id='sec:group-0:cell:row-0-0:col-0';
 const before=renderPoster(canvas,p,null).elements.find(e=>e.id===id);
 p.canvas={transforms:{'sec:group-0':{x:0,y:20,scale:1},[id]:{x:3,y:4,scale:1}},styles:{}};
 const after=renderPoster(canvas,p,null).elements.find(e=>e.id===id);
 assert.equal(after.x,before.x+3);assert.equal(after.y,before.y+24);
 p.canvas.transforms['sec:group-0'].scale=.8;
 const scaled=renderPoster(canvas,p,null).elements.find(e=>e.id===id);
 assert.equal(scaled.parentScale,.8);assert.ok(Math.abs(scaled.width-before.width*.8)<.001);
});

test('A4 fits every complete row on one sheet and preserves original data and hit targets', async () => {
 const {renderSheetPoster,A4_HEIGHT}=await import('../public/planning/price-studio-pages.js');
 const ctx=new Proxy({measureText:s=>({width:String(s).length*7})},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx};
 const p=createDefaultProject();p.design.format='fit';p.design.rowHeight=50;
 p.sections[0].rows=Array.from({length:30},(_,i)=>({id:'r'+i,weight:`${i+1}kg 미만`,prices:p.columns.map((_,j)=>String(i*1000+j))}));
 const original=JSON.stringify(p),r=renderSheetPoster(canvas,p,null);
 assert.equal(r.error,'');assert.equal(r.height,A4_HEIGHT);assert.equal(canvas.width,1800);assert.equal(canvas.height,2546);
 assert.equal(JSON.stringify(p),original);assert.ok(r.fitScale<1);
 assert.deepEqual(r.elements.filter(e=>e.binding.type==='weight'&&e.binding.sectionId==='group-0').map(e=>e.binding.rowId),p.sections[0].rows.map(r=>r.id));
 for(const e of r.elements){assert.ok(e.x>=0&&e.y>=0,e.id);assert.ok(e.x+e.width<=r.width&&e.y+e.height<=r.height,e.id);}
 const last=r.elements.find(e=>e.id==='sec:group-0:cell:r29:col-5');assert.equal(last.binding.rowId,'r29');assert.ok(last.parentScale<1);
 const q=createDefaultProject();q.design.format='fit';q.sections[3].items=Array.from({length:40},(_,i)=>({label:'관리 메뉴 '+i,value:String(i)}));
 const lists=renderSheetPoster(canvas,q,null);assert.equal(lists.height,A4_HEIGHT);assert.equal(lists.error,'');assert.deepEqual(lists.elements.filter(e=>e.binding.type==='item'&&e.binding.sectionId==='extras'&&e.binding.key==='label').map(e=>e.binding.index),Array.from({length:40},(_,i)=>i));
});

test('A4 preserves chosen spacing, keeps paired sections and leaves short layouts unscaled', async () => {
 const {renderSheetPoster,A4_HEIGHT}=await import('../public/planning/price-studio-pages.js');
 const ctx=new Proxy({measureText:s=>({width:String(s).length*7})},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx};
 const p=createDefaultProject();p.design.format='fit';p.design.rowHeight=40;const original=JSON.stringify(p),r=renderSheetPoster(canvas,p,null);
 assert.equal(r.error,'');assert.equal(r.height,A4_HEIGHT);assert.equal(JSON.stringify(p),original);
 const extras=r.elements.find(e=>e.id==='sec:extras'),cat=r.elements.find(e=>e.id==='sec:cat');assert.equal(extras.y,cat.y);assert.ok(extras.x+extras.width<cat.x);
 p.sections=[p.sections[0]];const short=renderSheetPoster(canvas,p,null);assert.equal(short.fitScale,1);assert.equal(short.height,A4_HEIGHT);
 p.design.format='content';assert.ok(renderSheetPoster(canvas,p,null).height<A4_HEIGHT);
});

test('poster renders supplementary items and descriptions saved with a matrix section', async()=>{
 const {renderPoster}=await import('../public/planning/price-studio-render.js');
 const ctx=new Proxy({measureText:s=>({width:String(s).length*7})},{get:(obj,key)=>key in obj?obj[key]:()=>{}}),canvas={getContext:()=>ctx};
 const p=createDefaultProject(),section=p.sections[0];
 section.content='방문 전에 털 상태를 알려 주세요.';section.items=[{label:'추가 관리',value:'상담'}];section.rows[0].prices[0]='상담';
 assert.equal(validateProject(p).sections[0].content,section.content);
 assert.deepEqual(semantic(fromCSV(toCSV(p))),semantic(p));
 const rendered=renderPoster(canvas,p,null);
 assert.equal(rendered.error,'');
 assert.ok(rendered.elements.some(e=>e.binding?.sectionId===section.id&&e.binding?.key==='content'));
 assert.ok(rendered.elements.some(e=>e.binding?.sectionId===section.id&&e.binding?.type==='item'&&e.binding?.key==='value'));
 assert.ok(rendered.elements.some(e=>e.binding?.sectionId===section.id&&e.binding?.type==='price'));
});

test('blank shop names do not add fallback text or empty header geometry', async()=>{
 const {renderPoster}=await import('../public/planning/price-studio-render.js');
 const drawn=[];
 const ctx=new Proxy({measureText:s=>({width:String(s).length*7}),fillText:s=>drawn.push(s)},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx};
 const p=createDefaultProject();
 const named=renderPoster(canvas,p,null);
 for(const name of ['', '   ']){
  p.brand.name=name;p.brand.title='';drawn.length=0;
  const result=renderPoster(canvas,p,null);
  assert.equal(result.error,'');
  assert.ok(!drawn.includes('우리 가게'));
  assert.ok(!result.elements.some(e=>e.id==='brand:name'||e.id==='brand:header'));
  assert.ok(result.elements.every(e=>[e.x,e.y,e.width,e.height].every(Number.isFinite)));
  assert.ok(result.requiredHeight<named.requiredHeight);
  const withLogo=renderPoster(canvas,p,{width:1200,height:800});
  assert.ok(withLogo.elements.some(e=>e.id==='brand:logo'));
  assert.ok(!withLogo.elements.some(e=>e.id==='brand:name'));
 }
});

test('logo backups preserve original supported image formats and larger display size',()=>{
 for(const format of ['png','jpeg','webp']){
  const p=createDefaultProject();p.brand.logo=`data:image/${format};base64,aGVsbG8=`;p.design.logoSize=180;
  assert.deepEqual(validateProject(p),p);
 }
 const p=createDefaultProject();p.brand.logo='data:image/svg+xml;base64,aGVsbG8=';
 assert.throws(()=>validateProject(p));
});

test('narrow text boxes reflow and move subsequent sections without changing text',async()=>{
 const {renderPoster}=await import('../public/planning/price-studio-render.js');
 const {createLatestProject}=await import('../public/planning/price-studio-latest.js');
 const p=createLatestProject();assert.doesNotThrow(()=>validateProject(p));
 assert.deepEqual(p.sections[2].rows[0].prices,['30000','20000','40000','55000','95000','105000']);
 assert.equal(p.sections[3].items.length,8);
 const ctx=new Proxy({measureText:s=>({width:String(s).length*7})},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx};
 const id='sec:group-0:breeds',before=renderPoster(canvas,p,null);
 p.canvas={styles:{[id]:{width:160}},transforms:{}};
 const after=renderPoster(canvas,p,null),box=after.elements.find(e=>e.id===id);
 assert.equal(box.width,160);assert.ok(box.height>before.elements.find(e=>e.id===id).height);
 assert.ok(after.elements.find(e=>e.id==='sec:group-1:title').y>before.elements.find(e=>e.id==='sec:group-1:title').y);
 assert.deepEqual(validateProject(p).canvas,p.canvas);
 assert.equal(after.error,'');
});

test('spacing settings survive backup validation and reject unsafe values',()=>{
 const p=createDefaultProject();Object.assign(p.design,{pageMargin:70,sectionPadding:30,columnGap:40});p.canvas={transforms:{},styles:{'sec:extras:note':{letterSpacing:2.5,lineHeight:2,padding:16}}};
 assert.deepEqual(validateProject(p),p);
 for(const [key,value] of [['letterSpacing',99],['lineHeight',0],['padding',-1]]){const invalid=structuredClone(p);invalid.canvas.styles['sec:extras:note'][key]=value;assert.throws(()=>validateProject(invalid));}
});

test('growing the logo preserves table geometry and expands paper instead of shrinking',async()=>{
 const {renderSheetPoster}=await import('../public/planning/price-studio-pages.js');
 const ctx=new Proxy({measureText:s=>({width:String(s).length*7})},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx};
 const p=createDefaultProject();p.design.format='portrait';p.design.logoSize=100;
 const before=renderSheetPoster(canvas,p,{width:1254,height:1254});p.design.logoSize=500;
 const after=renderSheetPoster(canvas,p,{width:1254,height:1254});
 assert.equal(before.fitScale,1);assert.equal(after.fitScale,1);assert.ok(after.height>before.height);
 for(const a of before.elements.filter(e=>e.id.startsWith('sec:'))){const b=after.elements.find(e=>e.id===a.id);assert.equal(b.x,a.x);assert.equal(b.width,a.width);assert.equal(b.height,a.height);assert.equal(b.y-a.y,400);}
});

test('print and decorative options survive backups and malformed sizes are rejected',()=>{
 const p=createDefaultProject();p.print={paper:'custom',width:594,height:841,orientation:'landscape',layout:'sheet',format:'svg',dpi:300,bleed:3,cropMarks:true};
 p.design.markerShape='paw';p.design.cornerShape='star';p.design.markerSize=30;p.design.border='rounded';
 assert.deepEqual(validateProject(structuredClone(p)),p);
 for(const print of [{...p.print,width:-1},{...p.print,height:Infinity},{...p.print,paper:'bad'},{...p.print,dpi:999},{...p.print,bleed:100},null])assert.throws(()=>validateProject({...p,print}));
 assert.throws(()=>validateProject({...p,design:{...p.design,markerShape:'<svg>'}}));
});

test('text frame alignment and a lone half-width section move within their own row',async()=>{
 const {renderPoster}=await import('../public/planning/price-studio-render.js');
 const ctx=new Proxy({measureText:s=>({width:String(s).length*7})},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx},p=createDefaultProject();
 p.canvas={transforms:{},styles:{'sec:group-0:breeds':{width:240,boxAlign:'right',fontFamily:'Jua'}}};
 const before=renderPoster(canvas,p,null),breed=before.elements.find(e=>e.id==='sec:group-0:breeds');assert.ok(breed.x>400);assert.equal(breed.width,240);
 p.sections.find(s=>s.id==='cat').span='full';p.sections.find(s=>s.id==='extras').layoutAlign='right';
 const after=renderPoster(canvas,p,null),extras=after.boxes.find(e=>e.id==='extras'),cat=after.boxes.find(e=>e.id==='cat');
 assert.ok(extras.width<450);assert.ok(extras.x>400);assert.ok(cat.y>=extras.y+extras.height);
 assert.deepEqual(validateProject(structuredClone(p)),p);
 assert.throws(()=>validateProject({...p,canvas:{styles:{'brand:name':{fontFamily:'unbundled'}}}}));
});


test('independent corner settings, outline styles and rounded borders survive backup',()=>{
 const p=createDefaultProject();p.design.border='rounded';p.design.borderRadius=70;p.design.borderPattern='dashed';p.design.cornerShape='angle';p.design.cornerSize=24;p.design.cornerDetails={tl:{shape:'round',x:70,y:24,rotation:20},tr:{shape:'heart',fill:'outline',color:'#123456'},bl:{shape:'none'}};
 assert.deepEqual(validateProject(structuredClone(p)),p);
 for(const detail of [{shape:'invalid'},{x:500},{stroke:-1},{fill:'url(x)'},{color:'bad'}])assert.throws(()=>validateProject({...p,design:{...p.design,cornerDetails:{tl:detail}}}));
});
