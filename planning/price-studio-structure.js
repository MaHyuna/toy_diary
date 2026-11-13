// Sections remain the content store; this tree controls their layout and nesting.
const copy=value=>structuredClone(value);
const uid=()=>crypto.randomUUID();
const group=(direction,children)=>({id:uid(),direction,children});
const isLeaf=node=>!!node&&typeof node.sectionId==='string';
const fail=message=>{throw new Error(message);};
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(value);
export function flattenStructure(tree){return isLeaf(tree)?[tree.sectionId]:(tree?.children||[]).flatMap(flattenStructure);}
function normalize(node,root=false){
 if(isLeaf(node))return {sectionId:node.sectionId};
 const children=node.children.map(child=>normalize(child)).filter(Boolean);
 if(!root&&children.length===0)return null;
 if(!root&&children.length===1)return children[0];
 const out={id:node.id,direction:node.direction,children};
 return root&&out.direction!=='column'?group('column',[out]):out;
}
export function validateStructure(tree,sections){
 const sectionIds=new Set(sections.map(s=>s.id)),refs=new Set(),ids=new Set();let count=0;
 if(sectionIds.size!==sections.length)fail('섹션 ID가 중복됐어요.');
 if(!tree||isLeaf(tree)||typeof tree!=='object'||Array.isArray(tree)||tree.direction!=='column')fail('레이아웃 루트 형식이 올바르지 않아요.');
 function read(node,depth){
  if(++count>100||depth>8)fail('레이아웃 단계나 요소가 너무 많아요.');
  if(!node||typeof node!=='object'||Array.isArray(node))fail('레이아웃 요소 형식이 올바르지 않아요.');
  if(Object.hasOwn(node,'sectionId')){
   if(!validId(node.sectionId)||!sectionIds.has(node.sectionId)||refs.has(node.sectionId)||Object.hasOwn(node,'children'))fail('레이아웃 섹션이 없거나 중복됐어요.');
   refs.add(node.sectionId);return {sectionId:node.sectionId};
  }
  if(!validId(node.id)||ids.has(node.id)||sectionIds.has(node.id)||!['row','column'].includes(node.direction)||!Array.isArray(node.children))fail('행·열 그룹 설정을 확인해 주세요.');
  ids.add(node.id);return {id:node.id,direction:node.direction,children:node.children.map(child=>read(child,depth+1))};
 }
 const out=read(tree,0);if(refs.size!==sectionIds.size)fail('레이아웃에 빠진 섹션이 있어요.');return normalize(out,true);
}
export function deriveStructure(p){
 if(p.structure)return copy(p.structure);
 const children=[];
 for(let i=0;i<p.sections.length;i++){
  const first=p.sections[i];let next=i+1;while(next<p.sections.length&&!p.sections[next].visible)next++;
  if(first.visible&&first.span==='half'&&first.kind!=='matrix'&&p.sections[next]?.span==='half'&&p.sections[next].kind!=='matrix'){
   children.push(group('row',p.sections.slice(i,next+1).map(s=>({sectionId:s.id}))));i=next;
  }else children.push({sectionId:first.id});
 }
 return group('column',children);
}
function locate(tree,id,parent=null,index=-1){
 if((isLeaf(tree)&&tree.sectionId===id)||(!isLeaf(tree)&&tree.id===id))return {node:tree,parent,index};
 if(!isLeaf(tree))for(let i=0;i<tree.children.length;i++){const found=locate(tree.children[i],id,tree,i);if(found)return found;}
 return null;
}
function detach(tree,id){if(isLeaf(tree))return tree.sectionId===id?null:tree;tree.children=tree.children.map(child=>detach(child,id)).filter(Boolean);return tree;}
function syncOrder(p,tree,sections=p.sections){const map=new Map(sections.map(s=>[s.id,s]));p.structure=tree;p.sections=flattenStructure(tree).map(id=>map.get(id));}
function cloneElementBag(bag,sourceId,newId){
 const prefix='sec:'+sourceId,result={};for(const [id,value] of Object.entries(bag||{}))if(id===prefix||id.startsWith(prefix+':'))result['sec:'+newId+id.slice(prefix.length)]=copy(value);return result;
}
export function placeSection(p,sourceId,targetId,position,{copy:duplicate=false}={}){
 if(!['before','after','left','right','inside-row','inside-column'].includes(position))fail('놓을 위치를 확인해 주세요.');
 const source=p.sections.find(s=>s.id===sourceId);if(!source)fail('이동할 섹션이 없어요.');
 const tree=validateStructure(deriveStructure(p),p.sections);if(!locate(tree,targetId))fail('놓을 대상이 없어요.');
 if(!duplicate&&sourceId===targetId)return sourceId;
 if(duplicate&&p.sections.length>=24)fail('섹션은 최대 24개까지 만들 수 있어요.');
 const placed=duplicate?{...copy(source),id:uid()}:source,leaf={sectionId:placed.id};
 if(!duplicate)detach(tree,sourceId);
 const target=locate(tree,targetId);if(!target)fail('자기 자신 안으로는 옮길 수 없어요.');
 const direction=['left','right','inside-row'].includes(position)?'row':'column',before=['before','left'].includes(position),inside=position.startsWith('inside-');
 if(inside&&!isLeaf(target.node)&&target.node.direction===direction)target.node.children.push(leaf);
 else if(!inside&&target.parent?.direction===direction)target.parent.children.splice(target.index+(before?0:1),0,leaf);
 else{
  const wrapper=group(direction,before?[leaf,target.node]:[target.node,leaf]);
  if(target.parent)target.parent.children.splice(target.index,1,wrapper);
  else{const old={...target.node,children:[...target.node.children]};wrapper.children=before?[leaf,old]:[old,leaf];tree.id=uid();tree.direction='column';tree.children=[wrapper];}
 }
 const sections=duplicate?[...p.sections,placed]:p.sections,result=validateStructure(normalize(tree,true),sections);
 if(duplicate&&p.canvas){for(const key of ['styles','transforms'])p.canvas[key]={...p.canvas[key],...cloneElementBag(p.canvas[key],sourceId,placed.id)};}
 syncOrder(p,result,sections);return placed.id;
}
// Reconcile older editor actions that add/delete content before touching layout.
export function syncStructure(p){
 if(!p.structure){p.structure=deriveStructure(p);return p.structure;}
 const tree=copy(p.structure),known=new Set(p.sections.map(s=>s.id));
 function prune(node){if(isLeaf(node))return known.has(node.sectionId)?node:null;node.children=node.children.map(prune).filter(Boolean);return node;}
 prune(tree);const present=new Set(flattenStructure(tree));for(const s of p.sections)if(!present.has(s.id))tree.children.push({sectionId:s.id});
 const result=validateStructure(tree,p.sections);syncOrder(p,result);return result;
}
export function removeSectionFromStructure(p,id){if(p.structure)p.structure=detach(copy(p.structure),id);return syncStructure(p);}

// Move/copy an entire layout group with all descendants as one object.
export function placeGroup(p,groupId,targetId,position,{copy:duplicate=false}={}){
 if(!['before','after','left','right','inside-row','inside-column'].includes(position))fail('놓을 위치를 확인해 주세요.');
 const tree=validateStructure(deriveStructure(p),p.sections),source=locate(tree,groupId),destination=locate(tree,targetId);
 if(!source||isLeaf(source.node)||!source.parent)fail('루트가 아닌 행·열 그룹을 선택해 주세요.');
 if(!destination)fail('놓을 대상이 없어요.');
 if(locate(source.node,targetId))fail('그룹을 자기 자신이나 하위 영역 안으로 옮길 수 없어요.');
 const leafIds=flattenStructure(source.node);if(duplicate&&p.sections.length+leafIds.length>24)fail('섹션은 최대 24개까지 만들 수 있어요.');
 const sectionCopies=[],sectionIds=new Map(),sectionsById=new Map(p.sections.map(s=>[s.id,s]));
 if(duplicate)for(const id of leafIds){const cloned=copy(sectionsById.get(id));cloned.id=uid();sectionIds.set(id,cloned.id);sectionCopies.push(cloned);}
 if(duplicate)for(const s of sectionCopies)if(s.flowSource&&sectionIds.has(s.flowSource.sectionId))s.flowSource.sectionId=sectionIds.get(s.flowSource.sectionId);
 function cloneGroup(node){return isLeaf(node)?{sectionId:sectionIds.get(node.sectionId)}:{id:uid(),direction:node.direction,children:node.children.map(cloneGroup)};}
 const placed=duplicate?cloneGroup(source.node):source.node;
 if(!duplicate)source.parent.children.splice(source.index,1);
 const target=locate(tree,targetId),direction=['left','right','inside-row'].includes(position)?'row':'column',before=['before','left'].includes(position),inside=position.startsWith('inside-');
 if(inside&&!isLeaf(target.node)&&target.node.direction===direction)target.node.children.push(placed);
 else if(!inside&&target.parent?.direction===direction)target.parent.children.splice(target.index+(before?0:1),0,placed);
 else{
  const wrapper=group(direction,before?[placed,target.node]:[target.node,placed]);
  if(target.parent)target.parent.children.splice(target.index,1,wrapper);
  else{const old={...target.node,children:[...target.node.children]};wrapper.children=before?[placed,old]:[old,placed];tree.id=uid();tree.direction='column';tree.children=[wrapper];}
 }
 const sections=duplicate?[...p.sections,...sectionCopies]:p.sections,result=validateStructure(normalize(tree,true),sections);
 if(duplicate&&p.canvas)for(const key of ['styles','transforms']){
  const additions={};for(const [oldId,newId] of sectionIds)Object.assign(additions,cloneElementBag(p.canvas[key],oldId,newId));p.canvas[key]={...p.canvas[key],...additions};
 }
 syncOrder(p,result,sections);return placed.id;
}
// Keep the form's width choices in sync with the explicit Row/Column tree.
export function setSectionFlow(p,id,span){const s=p.sections.find(v=>v.id===id);if(!s)return;s.span=s.kind==='matrix'?'full':span;if(!p.structure)return;let parents=[];function find(node,path=[]){if(node.sectionId===id){parents=path;return true;}return node.children?.some(child=>find(child,[...path,node]));}find(p.structure);const row=parents.findLast(node=>node.direction==='row');if(span==='full'&&row)placeSection(p,id,row.id,'after');else if(span==='half'&&!row){const index=p.sections.indexOf(s),peer=p.sections.slice(index+1).find(v=>v.visible)||p.sections.slice(0,index).reverse().find(v=>v.visible);if(peer)placeSection(p,id,peer.id,index<p.sections.indexOf(peer)?'left':'right');}}
