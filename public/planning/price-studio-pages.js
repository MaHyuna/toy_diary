import {renderPoster} from './price-studio-render.js?v=select-5';
export const A4_HEIGHT=1273;
// Pack whole sections first. Oversized tables split only between rows.
export function paginateProject(project,measure){
 const pages=[];let current=[];const fits=sections=>measure({...project,sections})<=A4_HEIGHT;
 const flush=()=>{if(current.length){pages.push({...project,sections:current});current=[];}};
 for(const section of project.sections.filter(s=>s.visible)){
  if(fits([...current,section])){current.push(section);continue;}
  if(fits([section])){flush();current.push(section);continue;}
  flush();const key=section.kind==='matrix'?'rows':section.kind==='list'?'items':'content';
  let remaining=section[key],offset=0;
  if(!remaining?.length)return {pages,error:`“${section.title}”의 제목·안내가 한 장보다 길어요. 글자 크기나 안내 길이를 줄여 주세요.`};
  while(remaining.length){
   let lo=1,hi=remaining.length,best=0;
   const part=n=>({...section,[key]:remaining.slice(0,n),...(key==='items'?{_itemOffset:offset}:{})});
   while(lo<=hi){const mid=Math.floor((lo+hi)/2);if(fits([part(mid)])){best=mid;lo=mid+1;}else hi=mid-1;}
   if(!best)return {pages,error:`“${section.title}”의 한 항목이 A4를 넘어요. 글자 크기·배치 또는 안내 길이를 줄여 주세요.`};
   // Prefer an existing paragraph boundary when splitting long prose.
   if(key==='content'&&best<remaining.length){const boundary=remaining.lastIndexOf('\n',best-1);if(boundary>best*.6)best=boundary+1;}
   current=[part(best)];remaining=remaining.slice(best);offset+=best;if(remaining.length)flush();
  }
 }
 flush();return {pages,error:pages.length?'':'표시할 섹션을 하나 이상 선택해 주세요.'};
}
export function renderPagedPoster(canvas,project,logo,pageIndex=0){
 if(project.design.format!=='portrait')return {...renderPoster(canvas,project,logo),pageIndex:0,pages:[project]};
 const scratch=document.createElement('canvas');
 const plan=paginateProject(project,p=>renderPoster(scratch,p,logo,{measureOnly:true}).requiredHeight);
 if(plan.error)return {...renderPoster(canvas,project,logo),error:plan.error,pages:[],pageIndex:0};
 const index=Math.max(0,Math.min(pageIndex,plan.pages.length-1));
 return {...renderPoster(canvas,plan.pages[index],logo,{fixedHeight:A4_HEIGHT}),pages:plan.pages,pageIndex:index};
}
// Store PNGs without recompression in a standard ZIP, avoiding multiple-download prompts.
export function zipFiles(files){
 const enc=new TextEncoder(),parts=[],entries=[];let offset=0;
 const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 for(const {name,bytes} of files){const n=enc.encode(name),sum=crc(bytes),header=new Uint8Array(30+n.length),v=new DataView(header.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,sum,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,n.length,true);header.set(n,30);parts.push(header,bytes);entries.push({n,sum,size:bytes.length,offset});offset+=header.length+bytes.length;}
 const start=offset;for(const e of entries){const h=new Uint8Array(46+e.n.length),v=new DataView(h.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,e.sum,true);v.setUint32(20,e.size,true);v.setUint32(24,e.size,true);v.setUint16(28,e.n.length,true);v.setUint32(42,e.offset,true);h.set(e.n,46);parts.push(h);offset+=h.length;}
 const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,offset-start,true);v.setUint32(16,start,true);parts.push(end);return new Blob(parts,{type:'application/zip'});
}
