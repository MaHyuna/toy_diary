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
 const p=createDefaultProject();p.design.rowHeight=50;
 p.sections[0].rows=Array.from({length:30},(_,i)=>({id:'r'+i,weight:`${i+1}kg 미만`,prices:p.columns.map((_,j)=>String(i*1000+j))}));
 const original=JSON.stringify(p),r=renderSheetPoster(canvas,p,null);
 assert.equal(r.error,'');assert.equal(r.height,A4_HEIGHT);assert.equal(canvas.width,1800);assert.equal(canvas.height,2546);
 assert.equal(JSON.stringify(p),original);assert.ok(r.fitScale<1);
 assert.deepEqual(r.elements.filter(e=>e.binding.type==='weight'&&e.binding.sectionId==='group-0').map(e=>e.binding.rowId),p.sections[0].rows.map(r=>r.id));
 for(const e of r.elements){assert.ok(e.x>=0&&e.y>=0,e.id);assert.ok(e.x+e.width<=r.width&&e.y+e.height<=r.height,e.id);}
 const last=r.elements.find(e=>e.id==='sec:group-0:cell:r29:col-5');assert.equal(last.binding.rowId,'r29');assert.ok(last.parentScale<1);
 const q=createDefaultProject();q.sections[3].items=Array.from({length:40},(_,i)=>({label:'관리 메뉴 '+i,value:String(i)}));
 const lists=renderSheetPoster(canvas,q,null);assert.equal(lists.height,A4_HEIGHT);assert.equal(lists.error,'');assert.deepEqual(lists.elements.filter(e=>e.binding.type==='item'&&e.binding.sectionId==='extras'&&e.binding.key==='label').map(e=>e.binding.index),Array.from({length:40},(_,i)=>i));
});

test('A4 reduces surplus spacing first, keeps paired sections and leaves short layouts unscaled', async () => {
 const {renderSheetPoster,A4_HEIGHT}=await import('../public/planning/price-studio-pages.js');
 const ctx=new Proxy({measureText:s=>({width:String(s).length*7})},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx};
 const p=createDefaultProject();p.design.rowHeight=40;const original=JSON.stringify(p),r=renderSheetPoster(canvas,p,null);
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
