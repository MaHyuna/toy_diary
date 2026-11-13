import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveStructure,validateStructure,flattenStructure,placeSection,syncStructure,removeSectionFromStructure} from '../public/planning/price-studio-structure.js';
const section=(id,span='full')=>({id,kind:'list',span,visible:true,title:id,items:[{label:id,value:'1000'}]});
const project=()=>({sections:[section('a','half'),section('hidden'),section('b','half'),section('c')],canvas:{styles:{'sec:a:item:0:label':{fontSize:15}},transforms:{'sec:a':{x:1,y:2,scale:1}}}});
test('legacy visible half sections form one row around hidden content without losing section order',()=>{
 const p=project();p.sections[1].visible=false;const t=deriveStructure(p);assert.equal(t.direction,'column');assert.equal(t.children[0].direction,'row');assert.deepEqual(flattenStructure(t),['a','hidden','b','c']);assert.deepEqual(flattenStructure(validateStructure(t,p.sections)),['a','hidden','b','c']);assert.equal(p.structure,undefined);
});
test('nested row/column placement changes flow and reparents sections without duplication',()=>{
 const p={sections:['a','b','c','d'].map(id=>section(id))};placeSection(p,'b','a','right');assert.equal(p.structure.children[0].direction,'row');assert.deepEqual(p.structure.children[0].children,[{sectionId:'a'},{sectionId:'b'}]);
 placeSection(p,'c','b','after');const row=p.structure.children[0];assert.equal(row.children[1].direction,'column');assert.deepEqual(flattenStructure(row.children[1]),['b','c']);
 placeSection(p,'a','d','after');assert.deepEqual(flattenStructure(p.structure),['b','c','d','a']);assert.deepEqual(p.sections.map(s=>s.id),['b','c','d','a']);assert.deepEqual(validateStructure(p.structure,p.sections),p.structure);
});
test('copying a section preserves columns/prices and copies its typography into a new section namespace',()=>{
 const p=project();p.sections[0].columns=[{id:'col',name:'Service',note:''}];p.sections[0].rows=[{id:'row',weight:'3kg',prices:['1000']}];const id=placeSection(p,'a','c','before',{copy:true}),duplicate=p.sections.find(s=>s.id===id);
 assert.notEqual(id,'a');assert.deepEqual(duplicate.columns,p.sections.find(s=>s.id==='a').columns);assert.deepEqual(p.canvas.styles['sec:'+id+':item:0:label'],{fontSize:15});assert.deepEqual(p.canvas.transforms['sec:'+id],{x:1,y:2,scale:1});duplicate.rows[0].prices[0]='9000';assert.equal(p.sections.find(s=>s.id==='a').rows[0].prices[0],'1000');assert.deepEqual(flattenStructure(p.structure),p.sections.map(s=>s.id));
});
test('invalid trees and targets fail transactionally rather than dropping content',()=>{
 const p={sections:['a','b'].map(id=>section(id))},base={id:'root',direction:'column',children:[{sectionId:'a'},{sectionId:'b'}]};
 assert.throws(()=>validateStructure({...base,children:[{sectionId:'a'},{sectionId:'a'}]},p.sections));assert.throws(()=>validateStructure({...base,children:[{sectionId:'a'}]},p.sections));assert.throws(()=>validateStructure({...base,direction:'grid'},p.sections));assert.throws(()=>validateStructure({...base,direction:'row'},p.sections));assert.throws(()=>validateStructure({...base,id:'a'},p.sections));
 const duplicateGroup={id:'root',direction:'column',children:[{id:'same',direction:'row',children:[{sectionId:'a'}]},{id:'same',direction:'row',children:[{sectionId:'b'}]}]};assert.throws(()=>validateStructure(duplicateGroup,p.sections));
 const before=structuredClone(p);assert.throws(()=>placeSection(p,'a','missing','before'));assert.deepEqual(p,before);assert.throws(()=>placeSection(p,'a','b','unknown'));assert.deepEqual(p,before);
 let nested={sectionId:'a'};for(let i=0;i<9;i++)nested={id:'n'+i,direction:'column',children:[nested]};nested.children.push({sectionId:'b'});assert.throws(()=>validateStructure(nested,p.sections));
});
test('add/delete reconciliation preserves nested groups and new sections appear exactly once',()=>{
 const p={sections:['a','b','c'].map(id=>section(id))};placeSection(p,'b','a','right');p.sections.push(section('d'));syncStructure(p);assert.deepEqual(flattenStructure(p.structure),['a','b','c','d']);p.sections=p.sections.filter(s=>s.id!=='a');removeSectionFromStructure(p,'a');assert.deepEqual(flattenStructure(p.structure),['b','c','d']);assert.equal(p.structure.children[0].sectionId,'b');
});
test('inside drops can target groups, and moving within a group is cycle-free',()=>{
 const p={sections:['a','b','c'].map(id=>section(id))};placeSection(p,'b','a','right');const rowId=p.structure.children[0].id;placeSection(p,'c',rowId,'inside-row');assert.deepEqual(flattenStructure(p.structure),['a','b','c']);assert.equal(p.structure.children[0].children.length,3);placeSection(p,'a',rowId,'inside-row');assert.deepEqual(flattenStructure(p.structure),['b','c','a']);
});

test('structure-aware widths support full-span paired sections inside a nested container',async()=>{
 const {pairedSections,rowMetrics,rowWidths,sectionWidth,setSectionWidth}=await import('../public/planning/price-studio-layout.js');
 const p={design:{pageMargin:48,columnGap:24,sectionPadding:24,flowers:false},sections:['a','b','c'].map(id=>section(id)),structure:{id:'root',direction:'column',children:[{id:'outer-row',direction:'row',children:[{id:'inner-column',direction:'column',children:[{id:'inner-row',direction:'row',children:[{sectionId:'a'},{sectionId:'b'}]}]},{sectionId:'c'}]}]}};
 p.sections[2].layoutWidth=200;
 assert.deepEqual(pairedSections(p,'a').map(s=>s.id),['a','b']);assert.equal(rowMetrics(p,'a').full,580);assert.deepEqual(rowWidths(p,p.sections[0],p.sections[1]),[278,278]);assert.equal(sectionWidth(p,p.sections[0]),278);
 setSectionWidth(p,'a',330);assert.equal(sectionWidth(p,p.sections[0]),330);assert.equal(sectionWidth(p,p.sections[1]),226);assert.equal(p.sections[0].span,'full');
 setSectionWidth(p,'a',10000);assert.equal(sectionWidth(p,p.sections[0]),392);assert.equal(sectionWidth(p,p.sections[1]),164);assert.equal(p.sections[1].layoutWidth,undefined);
});
test('row allocation protects minimum content width and recognizes narrow rows that must wrap',async()=>{
 const {structureRowWidths,structureRowStacks}=await import('../public/planning/price-studio-layout.js');const p={design:{pageMargin:48,columnGap:24,sectionPadding:24,flowers:false},sections:[section('a'),section('b')]};const children=p.sections.map(s=>({sectionId:s.id}));p.sections[0].layoutWidth=10000;
 assert.deepEqual(structureRowWidths(p,children,804),[616,164]);assert.equal(structureRowStacks(p,children,804),false);assert.equal(structureRowStacks(p,children,300),true);
 p.sections[0].layoutWidth=400;p.sections[1].layoutWidth=200;assert.deepEqual(structureRowWidths(p,children,804),[520,260]);
});

test('matrix minimum width follows its independent service count and clamps asymmetrically',async()=>{
 const {structureRowStacks,structureRowWidths,rowMetrics,setSectionWidth,sectionWidth}=await import('../public/planning/price-studio-layout.js');
 const p={design:{pageMargin:48,columnGap:24,sectionPadding:24,flowers:false},columns:Array.from({length:6},(_,i)=>({id:'col'+i})),sections:[{...section('matrix'),kind:'matrix'},section('list')],structure:{id:'root',direction:'column',children:[{id:'row',direction:'row',children:[{sectionId:'matrix'},{sectionId:'list'}]}]}};
 const children=p.structure.children[0].children;
 assert.equal(structureRowStacks(p,children,450),true);assert.equal(structureRowStacks(p,children,804),false);
 assert.equal(rowMetrics(p,'matrix').min,304);assert.equal(rowMetrics(p,'list').max,476);
 setSectionWidth(p,'list',10000);assert.equal(sectionWidth(p,p.sections[0]),304);assert.equal(sectionWidth(p,p.sections[1]),476);
 p.sections[0].columns=p.columns.slice(0,1);assert.equal(rowMetrics(p,'matrix').min,184);
});

test('moving a nested group retains its Row/Column hierarchy and leaf contents',async()=>{
 const {placeGroup}=await import('../public/planning/price-studio-structure.js');
 const p={sections:['a','b','c','d'].map(id=>section(id)),structure:{id:'root',direction:'column',children:[{id:'row',direction:'row',children:[{sectionId:'a'},{id:'inner',direction:'column',children:[{sectionId:'b'},{sectionId:'c'}]}]},{sectionId:'d'}]}};
 const before=structuredClone(p.sections);assert.equal(placeGroup(p,'row','d','after'),'row');assert.deepEqual(flattenStructure(p.structure),['d','a','b','c']);assert.equal(p.structure.children[1].id,'row');assert.equal(p.structure.children[1].children[1].id,'inner');assert.deepEqual(p.sections.find(s=>s.id==='a'),before[0]);assert.deepEqual(validateStructure(p.structure,p.sections),p.structure);
});
test('group copies remap all descendants, element styles, prices and internal origin references',async()=>{
 const {placeGroup}=await import('../public/planning/price-studio-structure.js');
 const p={sections:['a','b','c'].map(id=>section(id)),structure:{id:'root',direction:'column',children:[{id:'row',direction:'row',children:[{sectionId:'a'},{sectionId:'b'}]},{sectionId:'c'}]},canvas:{styles:{'sec:a:cell:r:c':{fontSize:17},'sec:b:content':{color:'#aabbcc'}},transforms:{'sec:a':{x:1,y:2,scale:1}}}};
 p.sections[0].columns=[{id:'service',name:'목욕',note:''}];p.sections[0].rows=[{id:'r',weight:'3kg',prices:['1000']}];p.sections[1].flowSource={sectionId:'a',key:'note'};
 const groupId=placeGroup(p,'row','c','after',{copy:true}),copied=p.structure.children.find(n=>n.id===groupId),[a,b]=flattenStructure(copied),aSection=p.sections.find(s=>s.id===a),bSection=p.sections.find(s=>s.id===b);
 assert.notEqual(groupId,'row');assert.notEqual(a,'a');assert.notEqual(b,'b');assert.deepEqual(p.canvas.styles['sec:'+a+':cell:r:c'],{fontSize:17});assert.deepEqual(p.canvas.styles['sec:'+b+':content'],{color:'#aabbcc'});assert.deepEqual(p.canvas.transforms['sec:'+a],{x:1,y:2,scale:1});assert.equal(bSection.flowSource.sectionId,a);
 aSection.rows[0].prices[0]='9000';aSection.columns[0].name='복사';assert.equal(p.sections.find(s=>s.id==='a').rows[0].prices[0],'1000');assert.equal(p.sections.find(s=>s.id==='a').columns[0].name,'목욕');assert.equal(p.sections.length,5);
});
test('group drops reject root/self/descendant cycles and copy overflow transactionally',async()=>{
 const {placeGroup}=await import('../public/planning/price-studio-structure.js');
 const p={sections:['a','b','c'].map(id=>section(id)),structure:{id:'root',direction:'column',children:[{id:'row',direction:'row',children:[{sectionId:'a'},{sectionId:'b'}]},{sectionId:'c'}]}};const original=structuredClone(p);
 for(const [source,target,position] of [['root','c','before'],['row','row','inside-row'],['row','a','inside-column'],['row','missing','left']]){assert.throws(()=>placeGroup(p,source,target,position));assert.deepEqual(p,original);}
 assert.throws(()=>placeGroup(p,'row','b','after',{copy:true}));assert.deepEqual(p,original);
 for(let i=0;i<20;i++){const s=section('extra'+i);p.sections.push(s);p.structure.children.push({sectionId:s.id});}const full=structuredClone(p);assert.throws(()=>placeGroup(p,'row','c','after',{copy:true}));assert.deepEqual(p,full);
});
