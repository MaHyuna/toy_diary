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
