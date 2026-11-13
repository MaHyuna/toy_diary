import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultProject,validateProject,toCSV,fromCSV,moveColumn} from '../public/planning/price-studio-data.js';
import {columnsFor,ownColumns,moveService,moveItem} from '../public/planning/price-studio-model.js';
import {renderPoster} from '../public/planning/price-studio-render.js';

const tableData=(p,s)=>({
 title:s.title,
 columns:columnsFor(p,s).map(({name,note})=>({name,note})),
 rows:s.rows.map(({weight,prices})=>({weight,prices})),
});
const tables=p=>p.sections.filter(s=>s.kind==='matrix').map(s=>tableData(p,s));
const rowByService=(p,s)=>s.rows.map(row=>Object.fromEntries(columnsFor(p,s).map((col,i)=>[col.id,row.prices[i]])));

function customProject(){
 const p=createDefaultProject(),[first,second]=p.sections.filter(s=>s.kind==='matrix');
 ownColumns(p,first)[0].name='소형견 전용 목욕';
 first.columns[0].note='첫 표에만 적용';
 first.columns.splice(2,1);for(const r of first.rows)r.prices.splice(2,1);
 ownColumns(p,second).push({id:'local-spa',name:'중형견 스파',note:'개별 서비스'});for(const [i,r] of second.rows.entries())r.prices.push(String(47000+i*1000));
 moveService(p,first,first.columns.length-1,0);
 return p;
}

test('claiming and renaming a table service leaves global defaults and every other table untouched',()=>{
 const p=createDefaultProject(),[first,second]=p.sections.filter(s=>s.kind==='matrix'),global=structuredClone(p.columns),other=tableData(p,second);
 const local=ownColumns(p,first);local[0].name='이 표만 변경';local[0].note='단독 설명';
 assert.equal(columnsFor(p,first),local);assert.notEqual(local,p.columns);assert.notEqual(local[0],p.columns[0]);
 assert.deepEqual(p.columns,global);assert.deepEqual(tableData(p,second),other);
 assert.deepEqual(validateProject(structuredClone(p)),p);
});

test('reordering one table carries all prices with the service and retains element IDs and other tables',()=>{
 const p=createDefaultProject(),[first,second]=p.sections.filter(s=>s.kind==='matrix'),original=rowByService(p,first),other=tableData(p,second),global=structuredClone(p.columns),ids=columnsFor(p,first).map(c=>c.id);
 p.canvas={styles:{[`sec:${first.id}:col:${ids[0]}`]:{color:'#aabbcc'}},transforms:{}};
 moveService(p,first,0,4);
 assert.equal(first.columns[4].id,ids[0]);assert.deepEqual(rowByService(p,first),original);
 assert.deepEqual(tableData(p,second),other);assert.deepEqual(p.columns,global);
 assert.deepEqual(p.canvas.styles[`sec:${first.id}:col:${ids[0]}`],{color:'#aabbcc'});
});

test('one-table add and delete produce unequal service counts without changing neighboring prices',()=>{
 const p=createDefaultProject(),[first,second]=p.sections.filter(s=>s.kind==='matrix'),other=tableData(p,second),original=first.rows.map(r=>r.prices.slice());
 ownColumns(p,first).push({id:'local-extra',name:'추가 작업',note:''});first.rows.forEach((r,i)=>r.prices.push(String(2000+i)));
 assert.equal(columnsFor(p,first).length,columnsFor(p,second).length+1);assert.deepEqual(tableData(p,second),other);assert.doesNotThrow(()=>validateProject(p));
 first.columns.splice(1,1);for(const r of first.rows)r.prices.splice(1,1);
 assert.deepEqual(first.rows.map(r=>r.prices),original.map((row,i)=>[row[0],...row.slice(2),String(2000+i)]));
 assert.deepEqual(tableData(p,second),other);assert.doesNotThrow(()=>validateProject(p));
});

test('full backup preserves table-specific IDs, labels, descriptions, counts and prices',()=>{
 const p=customProject();assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
});

test('CSV roundtrip preserves different service names, counts, order and price associations per table',()=>{
 const p=customProject(),copy=fromCSV(toCSV(p));assert.deepEqual(tables(copy),tables(p));
 assert.deepEqual(copy.columns.map(({name,note})=>({name,note})),p.columns.map(({name,note})=>({name,note})));
});

test('CSV rejects missing or duplicated per-table services and prices rather than shifting values',()=>{
 const p=customProject(),csv=toCSV(p),lines=csv.split('\r\n'),local=lines.findIndex(line=>line.startsWith('"section-column"'));
 assert.ok(local>0);assert.throws(()=>fromCSV(lines.toSpliced(local,1).join('\r\n')),/누락|달라/);
 assert.throws(()=>fromCSV([...lines.slice(0,local+1),lines[local],...lines.slice(local+1)].join('\r\n')),/중복/);
 const first=p.sections.find(s=>s.kind==='matrix'),missing=structuredClone(p);missing.sections.find(s=>s.id===first.id).rows[0].prices.pop();assert.throws(()=>validateProject(missing),/가격 칸/);
});

test('legacy global reorder skips tables that already own a service definition',()=>{
 const p=customProject(),first=p.sections[0],before=tableData(p,first),legacy=p.sections[2],association=rowByService(p,legacy);
 moveColumn(p,0,3);assert.deepEqual(tableData(p,first),before);assert.deepEqual(rowByService(p,legacy),association);
});

test('rendering a table uses its own service IDs, labels and price bindings when counts differ',()=>{
 const p=customProject(),ctx=new Proxy({measureText:s=>({width:String(s).length*7})},{get:(o,k)=>k in o?o[k]:()=>{}}),r=renderPoster({getContext:()=>ctx},p,null);
 for(const s of p.sections.filter(s=>s.kind==='matrix')){
  const cols=columnsFor(p,s),head=r.elements.filter(e=>e.binding.type==='column'&&e.binding.sectionId===s.id),cells=r.elements.filter(e=>e.binding.type==='price'&&e.binding.sectionId===s.id);
  assert.deepEqual(head.map(e=>e.binding.columnId),cols.map(c=>c.id));assert.equal(cells.length,s.rows.length*cols.length);
  for(const e of head)assert.equal(e.label,cols.find(c=>c.id===e.binding.columnId).name+' 열 제목');
 }
 assert.equal(r.error,'');
});

test('list reorder moves typography and transforms with their matching item instead of index position',()=>{
 const p=createDefaultProject(),s=p.sections.find(s=>s.kind==='list'),original=s.items.map(item=>structuredClone(item)),a=`sec:${s.id}:item:0:label`,b=`sec:${s.id}:item:1:value`;
 p.canvas={styles:{[a]:{color:'#aabbcc'},[b]:{fontSize:18}},transforms:{[a]:{x:3,y:4,scale:1}}};
 moveItem(p,s,0,2);assert.deepEqual(s.items[2],original[0]);assert.deepEqual(s.items[0],original[1]);
 assert.deepEqual(p.canvas.styles[`sec:${s.id}:item:2:label`],{color:'#aabbcc'});assert.deepEqual(p.canvas.styles[`sec:${s.id}:item:0:value`],{fontSize:18});assert.deepEqual(p.canvas.transforms[`sec:${s.id}:item:2:label`],{x:3,y:4,scale:1});
 assert.doesNotThrow(()=>validateProject(p));
});
