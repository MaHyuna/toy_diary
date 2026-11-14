import {flattenStructure} from './price-studio-structure.js?v=decor-27';
import {columnsFor} from './price-studio-model.js?v=decor-27';
import {rowWidths,sectionWidth,structureRowWidths,structureRowStacks} from './price-studio-layout.js?v=decor-27';
import {drawBorder,drawCorner,cornerGeometry,decorationTargets} from './price-studio-borders.js?v=decor-27';
import {drawShape} from './price-studio-shapes.js?v=decor-27';
import {layoutText} from './price-studio-text.js?v=decor-27';
export function renderPoster(canvas,p,logo,options={}){
 canvas.lang='ko';
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),W=900,m=p.design.pageMargin??48,B=W-m*2,d={...p.design,font:p.design.font==='Jua'?'Jua':'StudioSans'},c=d.colors,ops=[],boxes=[],elements=[],splits=[],rowDrops=[];let y=d.headerTop??d.pageMargin??36,error='';
 ctx.lang='ko';ctx.fontKerning='none';ctx.textRendering='geometricPrecision';
 const text=(v,x,y,font,color,align='left',width)=>{const op=()=>{const style=p.canvas?.styles?.[op.element]||{},size=style.fontSize||Number(font.match(/([\d.]+)px/)?.[1])||14;ctx.font=`${style.italic?'italic ':''}${style.bold===undefined?(font.startsWith('600')?'600':'400'):style.bold?'700':'400'} ${size}px ${style.fontFamily||(font.includes('Jua')?'Jua':'StudioSans')}`;ctx.letterSpacing=(style.letterSpacing||0)+'px';ctx.fillStyle=style.color||color;ctx.textAlign=style.align||align;let anchor=x;if(style.align&&style.align!==align){const e=elements.find(e=>e.id===op.element);if(e)anchor=style.align==='left'?e.x+(style.padding||0):style.align==='right'?e.x+e.width-(style.padding||0):e.x+e.width/2;}ctx.fillText(v,anchor,y,width||W);const mt=ctx.measureText(v),inkScale=Math.min(1,(width||W)/(mt.width||1)),inkWidth=mt.width*inkScale,left=ctx.textAlign==='center'?anchor-inkWidth/2:ctx.textAlign==='right'?anchor-inkWidth:anchor;op.ink={x:left,y:y-(mt.actualBoundingBoxAscent??size*.8),width:inkWidth,height:(mt.actualBoundingBoxAscent??size*.8)+(mt.actualBoundingBoxDescent??size*.2)+(style.underline?5:0)};if(style.underline){const measured=Math.min(ctx.measureText(v).width,width||W);const left=ctx.textAlign==='center'?anchor-measured/2:ctx.textAlign==='right'?anchor-measured:anchor;ctx.fillRect(left,y+3,measured,Math.max(1,size/16));}};op.textStyle={color,bold:/^(600|700)/.test(font),fontSize:Number(font.match(/([\d.]+)px/)?.[1])||14,align};ops.push(op);};
 const tag=(start,id)=>{for(let i=start;i<ops.length;i++){ops[i].owners=[id,...(ops[i].owners||[])];if(!ops[i].element)ops[i].element=id;}};
 const mark=(id,rect,binding,start,label,kind='text',maxWidth)=>{tag(start,id);const resizable=kind==='text'&&(binding.type==='section'||binding.type==='brand'||binding.type==='item'&&binding.key==='label');elements.push({id,...rect,binding,label,kind,resizable,maxWidth:maxWidth||rect.width});};
 const rect=(x,y,width,height)=>({x,y,width,height});
 const wrap=(s,width,font)=>{
  ctx.font=font;ctx.letterSpacing='0px';const result=[];
  for(const para of String(s).split('\n')){let row='';const tokens=para.match(/\S+\s*/g)||[];
   for(const token of tokens){
    if(row&&ctx.measureText(row+token.trimEnd()).width>width){result.push(row.trimEnd());row='';}
    for(const ch of token){if(!row&&/\s/.test(ch))continue;if(row&&ctx.measureText(row+ch).width>width){result.push(row.trimEnd());row='';}row+=ch;}
   }
   if(row.trim())result.push(row.trimEnd());
  }
  // A closing bracket must travel with the preceding word, never form an orphan line.
  for(let i=1;i<result.length;i++)if(/^[)\]}〉》.,:;!?%]+$/.test(result[i].trim())){const tail=result[i-1].match(/\S+$/)?.[0]||'';if(tail&&ctx.measureText(tail+result[i]).width<=width){result[i-1]=result[i-1].slice(0,-tail.length).trimEnd();result[i]=tail+result[i];}}
  return result.filter(Boolean);
 };
 const brandBlock=(key,top,font,step,color,align='center')=>{const id='brand:'+key,st=p.canvas?.styles?.[id]||{},w=Math.min(st.width||B,B),boxAlign=st.boxAlign||align,x=m+(boxAlign==='center'?(B-w)/2:boxAlign==='right'?B-w:0),begin=ops.length,l=layoutText(ctx,p.brand[key],w,font,step,st);l.lines.forEach((v,i)=>text(v,align==='center'?x+w/2:x+l.padding,top+l.padding+l.ascent+i*l.step,l.font,color,align,l.inner));mark(id,rect(x,top,w,l.height),{type:'brand',key},begin,{name:'매장 이름',title:'요금표 제목',footer:'하단 안내',contact:'매장 연락처'}[key],'text',B);return top+l.height;};
 const brandWidth=id=>Math.min(p.canvas?.styles?.[id]?.width||B,B);
 const line=(x,y,w,color,width=1)=>ops.push(()=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.stroke();});
 const flower=(x,y)=>{if(d.flowers)ops.push(()=>drawShape(ctx,d.markerShape||'flower',x,y,d.markerSize||18,c.decoration,c.background));};
 if(logo){const logoStart=ops.length,logoTop=y;const scale=Math.min(d.logoSize/logo.width,d.logoSize/logo.height),w=logo.width*scale,h=logo.height*scale;ops.push(()=>ctx.drawImage(logo,(W-w)/2,logoTop,w,h));mark('brand:logo',rect((W-w)/2,logoTop,w,h),{type:'logo'},logoStart,'매장 로고','image');y+=h+18;}else y+=8;
 if(p.brand.name.trim())y=brandBlock('name',y,`400 26px ${d.font}`,33,c.heading)+6;
 if(p.brand.title.trim())y=brandBlock('title',y,'16px StudioSans',25,c.heading)+1;y+=14;
 if(elements.length){const top=Math.min(...elements.map(e=>e.y)),bottom=Math.max(...elements.map(e=>e.y+e.height));mark('brand:header',rect(m,top,B,bottom-top),{type:'brandGroup'},0,'매장 정보','group');}
 const metrics=(font,value='가나다 0123456789')=>{ctx.font=font;const mt=ctx.measureText(value),size=Number(font.match(/([\d.]+)px/)?.[1])||14;return {ascent:mt.actualBoundingBoxAscent??size*.8,descent:mt.actualBoundingBoxDescent??size*.2};};
 function section(s,x,top,width){
  const columns=columnsFor(p,s),start=ops.length,style=s.style||{},sc={heading:style.heading||c.category,body:style.body||c.body,price:style.price||c.price,note:style.note||c.note,line:style.line||c.line,tableHeader:style.tableHeader||c.tableHeader||c.body};
  const pad=Math.max(d.sectionPadding??24,d.flowers?(d.markerSize||18)+6:0),inner=width-pad*2,xx=x+pad;let yy=top;
  const block=(value,left,at,w,font,step,color,id,binding,label,align='left')=>{
   const begin=ops.length,maxWidth=w,st=p.canvas?.styles?.[id]||{};w=Math.min(st.width||w,w);
   const areaX=align==='right'?left-maxWidth:align==='center'?left-maxWidth/2:left,boxAlign=st.boxAlign||align;
   const layout=layoutText(ctx,value,w,font,step,st),x=areaX+(boxAlign==='right'?maxWidth-w:boxAlign==='center'?(maxWidth-w)/2:0);
   const anchor=align==='right'?x+w-layout.padding:align==='center'?x+w/2:x+layout.padding;
   layout.lines.forEach((v,i)=>text(v,anchor,at+layout.padding+layout.ascent+i*layout.step,layout.font,color,align,layout.inner));
   mark(id,rect(x,at,w,layout.height),binding,begin,label,'text',maxWidth);return at+layout.height;
  };
  const noteFont=`${d.bodySize-1}px StudioSans`;let inlineNote=false;
  if(!(s.kind==='text'&&s.hideHeading)){
  if(!s.title.trim())error='섹션 제목을 입력해 주세요.';
  const titleId='sec:'+s.id+':title',headingSize=p.canvas?.styles?.[titleId]?.fontSize||d.headingSize,headingFont=`400 ${headingSize}px ${p.canvas?.styles?.[titleId]?.fontFamily||d.font}`,titleLines=wrap(s.title,Math.min(p.canvas?.styles?.[titleId]?.width||inner,inner),headingFont),titleMetrics=metrics(headingFont,titleLines[0]||'가');
  // Use the actual first line's ink center for the ornament and title baseline.
  flower(x+(d.markerSize||18)/2,yy+(titleMetrics.ascent+titleMetrics.descent)/2);
  const headingTop=yy;
  yy=block(s.title,xx,yy,inner,headingFont,Math.ceil(headingSize*1.22),sc.heading,titleId,{type:'section',sectionId:s.id,key:'title'},s.title+' 제목');
  const titleStyle=p.canvas?.styles?.[titleId]||{},titleLayout=layoutText(ctx,s.title,Math.min(titleStyle.width||inner,inner),headingFont,Math.ceil(headingSize*1.22),titleStyle);
  ctx.font=titleLayout.font;ctx.letterSpacing=titleLayout.spacing+'px';
  const titleInk=Math.max(...titleLayout.lines.map(line=>ctx.measureText(line).width)),headingWidth=Math.min(inner,Math.max(titleStyle.width||0,titleInk+2*titleLayout.padding)),noteX=xx+headingWidth+18,noteText='/ '+s.note,noteStyle=p.canvas?.styles?.['sec:'+s.id+':note']||{};
  const noteAvailable=Math.max(8,xx+inner-noteX),noteLayout=layoutText(ctx,noteText,Math.min(noteStyle.width||noteAvailable,noteAvailable),noteFont,d.bodySize+4,noteStyle);
  inlineNote=s.kind==='matrix'&&!!s.note&&titleLayout.lines.length===1&&noteAvailable>=80;
  if(inlineNote){const titleBox=elements.find(e=>e.id===titleId);titleBox.width=Math.min(titleBox.width,headingWidth+4);const noteTop=headingTop+Math.max(0,(titleLayout.height-noteLayout.height)/2);yy=Math.max(yy,block(noteText,noteX,noteTop,xx+inner-noteX,noteFont,d.bodySize+4,sc.note,'sec:'+s.id+':note',{type:'section',sectionId:s.id,key:'note'},s.title+' 안내'));}
  yy+=s.breeds?2:8;
  if(s.breeds)yy=block(s.breeds,xx,yy,inner,`${d.bodySize-1}px StudioSans`,d.bodySize+5,sc.body,'sec:'+s.id+':breeds',{type:'section',sectionId:s.id,key:'breeds'},s.title+' 견종 설명');
  }
  if(s.kind==='matrix'){
   if(columns.some(col=>!col.name.trim()))error='서비스 열 이름을 입력해 주세요.';
   if(s.note&&!inlineNote){yy+=3;yy=block(s.note,xx,yy,inner,noteFont,d.bodySize+4,sc.note,'sec:'+s.id+':note',{type:'section',sectionId:s.id,key:'note'},s.title+' 안내');}
   yy+=10;const tableStart=ops.length,tableTop=yy,weightWidth=d.weightColumnWidth??112,cw=(inner-weightWidth)/columns.length;
   const cells=[{value:s.weightLabel??'몸무게',x:xx,w:weightWidth,id:'sec:'+s.id+':weight-header',binding:{type:'weightHeader',sectionId:s.id},label:s.title+' 몸무게 헤더'},...columns.map((col,j)=>({value:(col.note?'('+col.note+')\n':'')+col.name,x:xx+weightWidth+cw*j,w:cw,id:'sec:'+s.id+':col:'+col.id,binding:{type:'column',sectionId:s.id,columnId:col.id,key:'name'},label:col.name+' 열 제목'}))];
   for(const cell of cells)cell.layout=layoutText(ctx,cell.value,cell.w-8,`600 ${d.bodySize}px StudioSans`,d.bodySize+4,p.canvas?.styles?.[cell.id]||{});
   const headHeight=Math.max(...cells.map(cell=>cell.layout.height))+10;
   for(const cell of cells){const begin=ops.length,l=cell.layout;l.lines.forEach((v,i)=>text(v,cell.x+cell.w/2,yy+(headHeight-l.height)/2+l.padding+l.ascent+i*l.step,l.font,sc.tableHeader,'center',l.inner));if(cell.id)mark(cell.id,rect(cell.x,yy,cell.w,headHeight),cell.binding,begin,cell.label);}
   yy+=headHeight;line(xx,yy,inner,sc.line,.9);yy+=5;
   for(const r of s.rows){
    if(!r.weight.trim())error='몸무게 행 이름을 입력해 주세요.';
    const rowCells=[{value:r.weight,x:xx,w:weightWidth,id:'sec:'+s.id+':row:'+r.id,binding:{type:'weight',sectionId:s.id,rowId:r.id},label:s.title+' '+r.weight,font:`${d.bodySize}px StudioSans`,color:sc.body},...r.prices.map((v,j)=>{const empty=v.trim()==='',n=Number(v);if(!empty&&Number.isFinite(n)&&(!Number.isInteger(n)||n<0||n>100000000))error='금액 범위를 확인해 주세요.';return {value:empty?'—':Number.isFinite(n)?n.toLocaleString('ko-KR'):v,x:xx+weightWidth+cw*j,w:cw,id:'sec:'+s.id+':cell:'+r.id+':'+columns[j].id,binding:{type:'price',sectionId:s.id,rowId:r.id,columnId:columns[j].id},label:s.title+' '+r.weight+' '+columns[j].name+' 가격',font:`600 ${d.priceSize}px StudioSans`,color:sc.price};})];
    for(const cell of rowCells)cell.layout=layoutText(ctx,cell.value,cell.w-8,cell.font,d.bodySize+4,p.canvas?.styles?.[cell.id]||{});
    const rh=Math.max(d.rowHeight,...rowCells.map(cell=>cell.layout.height+8));
    for(const cell of rowCells){const begin=ops.length,l=cell.layout;l.lines.forEach((v,i)=>text(v,cell.x+cell.w/2,yy+(rh-l.height)/2+l.padding+(l.step-l.ascent-l.descent)/2+l.ascent+i*l.step,l.font,cell.color,'center',l.inner));mark(cell.id,rect(cell.x,yy,cell.w,rh),cell.binding,begin,cell.label);}yy+=rh;
   }
   mark('sec:'+s.id+':table',rect(xx,tableTop,inner,yy-tableTop),{type:'table',sectionId:s.id},tableStart,s.title+' 가격표','group');
  }
  if(s.kind==='list'||s.kind==='matrix'&&s.items?.length){
   yy+=6;
   // Share each row's space between its label and amount. Resizing the label
   // reallocates the amount column instead of clamping to its current width.
   for(const [localIndex,item] of s.items.entries()){
    const index=localIndex+(s._itemOffset||0),labelId='sec:'+s.id+':item:'+index+':label',valueId='sec:'+s.id+':item:'+index+':value';
    const ls=p.canvas?.styles?.[labelId]||{},vs=p.canvas?.styles?.[valueId]||{},gap=12,maxNameWidth=inner-64-gap;
    let labelSize=ls.fontSize||d.bodySize,priceSize=vs.fontSize||d.priceSize;
    const font=(size,st,bold=false)=>`${st.italic?'italic ':''}${st.bold===undefined?(bold?'600':'400'):st.bold?'700':'400'} ${size}px ${st.fontFamily||'StudioSans'}`;
    let labelFont=font(labelSize,ls),priceFont=font(priceSize,vs,true);
    ctx.font=labelFont;ctx.letterSpacing=(ls.letterSpacing||0)+'px';let labelNatural=ctx.measureText(item.label).width+2;ctx.font=priceFont;ctx.letterSpacing=(vs.letterSpacing||0)+'px';let valueNatural=ctx.measureText(item.value||'—').width+4;
    const nameWidth=ls.width?Math.max(40,Math.min(ls.width,maxNameWidth)):Math.max(40,inner-Math.min(inner*.55,Math.max(64,valueNatural))-gap),valueWidth=inner-nameWidth-gap;
    const labelLayout=layoutText(ctx,item.label,nameWidth,labelFont,labelSize+5,ls),valueLayout=layoutText(ctx,item.value||'—',valueWidth,priceFont,priceSize+4,vs),rh=Math.max(30,labelLayout.height+12,valueLayout.height+12);
    let begin=ops.length,l=labelLayout;l.lines.forEach((v,i)=>text(v,xx+l.padding,yy+(rh-l.height)/2+l.padding+(l.step-l.ascent-l.descent)/2+l.ascent+i*l.step,l.font,sc.body,'left',l.inner));mark(labelId,rect(xx,yy,nameWidth,rh),{type:'item',sectionId:s.id,index,key:'label'},begin,item.label+' 항목','text',maxNameWidth);
    begin=ops.length;l=valueLayout;l.lines.forEach((v,i)=>text(v,x+width-pad-l.padding,yy+(rh-l.height)/2+l.padding+(l.step-l.ascent-l.descent)/2+l.ascent+i*l.step,l.font,sc.price,'right',l.inner));mark(valueId,rect(x+width-pad-valueWidth,yy,valueWidth,rh),{type:'item',sectionId:s.id,index,key:'value'},begin,item.label+' 금액');yy+=rh;
   }
  }
  if(s.kind==='text'&&s.content){yy+=4;yy=block(s.content,xx,yy,inner,`${d.bodySize}px StudioSans`,d.bodySize+7,sc.body,'sec:'+s.id+':content',{type:'section',sectionId:s.id,key:'content'},s.title+' 내용');}
  if(s.note&&s.kind!=='matrix'){yy+=8;yy=block(s.note,xx,yy,inner,`${d.bodySize-1}px StudioSans`,d.bodySize+5,sc.note,'sec:'+s.id+':note',{type:'section',sectionId:s.id,key:'note'},s.title+' 안내');}
  if(s.kind!=='text'&&s.content){yy+=8;yy=block(s.content,xx,yy,inner,`${d.bodySize}px StudioSans`,d.bodySize+7,sc.body,'sec:'+s.id+':content',{type:'section',sectionId:s.id,key:'content'},s.title+' 내용');}
  yy+=10;const h=yy-top;
  ops.splice(start,0,()=>{if(style.background){ctx.fillStyle=style.background;ctx.fillRect(x,top-8,width,h+8);}if(style.border&&style.border!=='none'){ctx.save();ctx.strokeStyle=sc.line;ctx.lineWidth=style.borderWidth||1;if(style.border==='dashed')ctx.setLineDash([5,4]);ctx.strokeRect(x,top-8,width,h+8);ctx.restore();}});
  mark('sec:'+s.id,rect(x,top-8,width,h+8),{type:'sectionGroup',sectionId:s.id},start,s.title+' 섹션','group');boxes.push({id:s.id,x,y:top-8,width,height:h+8});return yy;
 }
 const visible=p.sections.filter(s=>s.visible);
 if(p.structure){
  const sections=new Map(p.sections.map(s=>[s.id,s]));
  const shown=node=>node.sectionId?sections.get(node.sectionId)?.visible:node.children.some(shown);
  function frame(node,x,top,width){
   if(node.sectionId){const s=sections.get(node.sectionId);if(!s?.visible)return top;const bottom=section(s,x,top,width);rowDrops.push({sectionIds:[s.id],x,y:bottom+d.gap/2-10,width,height:20});return bottom;}
   const children=node.children.filter(shown);if(!children.length)return top;
   if(node.direction==='column'||structureRowStacks(p,children,width)){let bottom=top;for(const [i,child] of children.entries())bottom=frame(child,x,i?bottom+d.gap:top,width);return bottom;}
   const gap=d.columnGap??24,widths=structureRowWidths(p,children,width);
   let xx=x,bottom=top;children.forEach((child,i)=>{bottom=Math.max(bottom,frame(child,xx,top,widths[i]));xx+=widths[i]+gap;});
   const ids=flattenStructure(node).filter(id=>sections.get(id)?.visible);rowDrops.push({sectionIds:ids,x,y:bottom+d.gap/2-10,width,height:20});
   if(children.length===2&&children.every(c=>c.sectionId))splits.push({leftId:children[0].sectionId,rightId:children[1].sectionId,x:x+widths[0]+gap/2,y:top-8,width:0,height:bottom-top+8,leftWidth:widths[0]});return bottom;
  }
  y=frame(p.structure,m,y,B)+d.gap;
 }else{
for(let i=0;i<visible.length;i++){
  const s=visible[i];if(s.span==='half'&&s.kind!=='matrix'&&visible[i+1]?.span==='half'&&visible[i+1].kind!=='matrix'){
   const next=visible[++i],gutter=d.columnGap??24,[leftWidth,rightWidth]=rowWidths(p,s,next),top=y;
   y=Math.max(section(s,m,top,leftWidth),section(next,m+leftWidth+gutter,top,rightWidth));
   splits.push({leftId:s.id,rightId:next.id,x:m+leftWidth+gutter/2,y:top-8,width:0,height:y-top+8,leftWidth});rowDrops.push({sectionIds:[s.id,next.id],x:m,y:y+d.gap/2-10,width:B,height:20});y+=d.gap;
  }else{const width=sectionWidth(p,s),x=m+(s.layoutAlign==='right'?B-width:s.layoutAlign==='center'?(B-width)/2:0);y=section(s,x,y,width);rowDrops.push({sectionIds:[s.id],x:m,y:y+d.gap/2-10,width:B,height:20});y+=d.gap;}
 }
 }

 if(visible.length)y+=16-d.gap;
 if(!visible.length)error='표시할 섹션을 하나 이상 선택해 주세요.';
 const footerStart=ops.length,footerElementStart=elements.length;
 if(p.brand.footer)y=brandBlock('footer',y,'12px StudioSans',20,c.note,'left');
 if(p.brand.contact)y=brandBlock('contact',y+16,'13px StudioSans',21,c.body);
 if(elements.length>footerElementStart){const items=elements.slice(footerElementStart),top=Math.min(...items.map(e=>e.y)),bottom=Math.max(...items.map(e=>e.y+e.height));mark('brand:footerGroup',rect(m,top,B,bottom-top),{type:'brandGroup'},footerStart,'하단 안내','group');}
 const byId=new Map(elements.map(e=>[e.id,e]));
 const chains=new Map();for(const e of elements){const op=ops.find(op=>op.owners?.includes(e.id));const chain=op?.owners?.slice(0,op.owners.indexOf(e.id)+1)||[e.id];chains.set(e.id,chain);}
 const matrixFor=chain=>{let scale=1,dx=0,dy=0;for(const id of chain){const e=byId.get(id),tr=p.canvas?.transforms?.[id];if(!e||!tr)continue;dx+=scale*(e.x+tr.x-e.x*tr.scale);dy+=scale*(e.y+tr.y-e.y*tr.scale);scale*=tr.scale;}return {scale,dx,dy};};
 let positioned=elements.map(e=>{const chain=chains.get(e.id),tr=matrixFor(chain),parent=matrixFor(chain.slice(0,-1));return {...e,base:{x:e.x,y:e.y,width:e.width,height:e.height},x:e.x*tr.scale+tr.dx,y:e.y*tr.scale+tr.dy,width:e.width*tr.scale,height:e.height*tr.scale,parentScale:parent.scale,owners:chain,textStyle:ops.find(op=>op.element===e.id&&op.textStyle)?.textStyle};});
 const extent=Math.max(y,...positioned.map(e=>e.y+e.height));
 if(positioned.some(e=>e.x<-.5||e.y<-.5||e.x+e.width>W+.5))error='화면 밖으로 나간 요소를 안쪽으로 이동하거나 자동 정렬해 주세요.';
 const required=Math.ceil(extent+40),H=options.fixedHeight||Math.max(900,required);
 // Fit the complete composition inside one sheet. The paper and its border never scale.
 const safe=options.fitToPage?d.borderInset+(d.fitPadding??12):Math.max(36,d.borderInset+14),top=Math.min(safe,...positioned.map(e=>e.y)),bottom=Math.max(extent,...positioned.map(e=>e.y+e.height));
 const fitScale=options.fitToPage?Math.min(1,(H-safe*2)/(bottom-top)):1,fitX=(W-W*fitScale)/2,fitY=fitScale<1?safe-top*fitScale:0;
 const fitted=e=>({...e,x:e.x*fitScale+fitX,y:e.y*fitScale+fitY,width:e.width*fitScale,height:e.height*fitScale,...(e.parentScale===undefined?{}:{parentScale:e.parentScale*fitScale})});
 if(fitScale<1){positioned=positioned.map(fitted);for(let i=0;i<boxes.length;i++)boxes[i]=fitted(boxes[i]);}
 if(required>H&&!options.fitToPage)error='요소가 용지 영역을 넘어요. 배치를 자동 정렬하거나 크기를 줄여 주세요.';if(H>6000)error='내용이 너무 길어요. 섹션을 나누거나 줄여 주세요.';
 if(options.measureOnly)return {error,requiredHeight:required,elements:positioned,width:W,height:H,fitScale};
 canvas.width=W*2;canvas.height=Math.min(H,6000)*2;ctx.setTransform(2,0,0,2,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.lang='ko';ctx.fontKerning='none';ctx.textRendering='geometricPrecision';ctx.fillStyle=c.background;ctx.fillRect(0,0,W,H);
 drawBorder(ctx,d,W,H);

 ctx.save();ctx.translate(fitX,fitY);ctx.scale(fitScale,fitScale);
 for(const op of ops){ctx.save();const tr=matrixFor(op.owners||[]);ctx.translate(tr.dx,tr.dy);ctx.scale(tr.scale,tr.scale);ctx.elementId=op.element||'decoration';op();ctx.restore();}ctx.restore();
 // Editable text boxes include blank space. Test ornaments against the printed ink.
 const occupied=positioned.filter(e=>e.kind==='image');for(const op of ops)if(op.ink){const tr=matrixFor(op.owners||[]),b=op.ink;occupied.push(fitted({x:b.x*tr.scale+tr.dx,y:b.y*tr.scale+tr.dy,width:b.width*tr.scale,height:b.height*tr.scale}));}
 if(d.corners)for(const corner of cornerGeometry(d,W,H)){if(corner.settings.shape==='none')continue;const {x,y,r}=corner;const collision=occupied.some(e=>x+r>e.x&&x-r<e.x+e.width&&y+r>e.y&&y-r<e.y+e.height);if(collision){error=corner.label+' 모서리가 내용과 겹쳐요. 크기나 위치를 조절해 주세요.';continue;}ctx.elementId='corner:'+corner.key;drawCorner(ctx,corner.settings,x,y,corner.angle,c.background);}
 return {error,boxes,elements:positioned,decorations:decorationTargets(d,W,H),splits:splits.map(fitted),rowDrops:rowDrops.map(fitted),width:W,height:Math.min(H,6000),requiredHeight:required,fitScale};
}
