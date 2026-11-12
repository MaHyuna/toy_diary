import {layoutText} from './price-studio-text.js?v=logo-layout-16';
export function renderPoster(canvas,p,logo,options={}){
 canvas.lang='ko';
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),W=900,m=p.design.pageMargin??48,B=W-m*2,d=p.design,c=d.colors,ops=[],boxes=[],elements=[];let y=d.pageMargin??36,error='';
 ctx.lang='ko';ctx.fontKerning='none';ctx.textRendering='geometricPrecision';
 const text=(v,x,y,font,color,align='left',width)=>{const op=()=>{const style=p.canvas?.styles?.[op.element]||{},size=style.fontSize||Number(font.match(/([\d.]+)px/)?.[1])||14;ctx.font=`${style.italic?'italic ':''}${style.bold===undefined?(font.startsWith('600')?'600':'400'):style.bold?'700':'400'} ${size}px ${font.includes('Jua')?'Jua':'sans-serif'}`;ctx.letterSpacing=(style.letterSpacing||0)+'px';ctx.fillStyle=style.color||color;ctx.textAlign=style.align||align;let anchor=x;if(style.align&&style.align!==align){const e=elements.find(e=>e.id===op.element);if(e)anchor=style.align==='left'?e.x+(style.padding||0):style.align==='right'?e.x+e.width-(style.padding||0):e.x+e.width/2;}ctx.fillText(v,anchor,y,width||W);if(style.underline){const measured=Math.min(ctx.measureText(v).width,width||W);const left=ctx.textAlign==='center'?anchor-measured/2:ctx.textAlign==='right'?anchor-measured:anchor;ctx.fillRect(left,y+3,measured,Math.max(1,size/16));}};op.textStyle={color,fontSize:Number(font.match(/([\d.]+)px/)?.[1])||14,align};ops.push(op);};
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
 const brandBlock=(key,top,font,step,color,align='center')=>{const id='brand:'+key,st=p.canvas?.styles?.[id]||{},w=Math.min(st.width||B,B),x=align==='center'?(W-w)/2:m,begin=ops.length,l=layoutText(ctx,p.brand[key],w,font,step,st);l.lines.forEach((v,i)=>text(v,align==='center'?x+w/2:x+l.padding,top+l.padding+l.ascent+i*l.step,l.font,color,align,l.inner));mark(id,rect(x,top,w,l.height),{type:'brand',key},begin,{name:'매장 이름',title:'요금표 제목',footer:'하단 안내',contact:'매장 연락처'}[key],'text',B);return top+l.height;};
 const brandWidth=id=>Math.min(p.canvas?.styles?.[id]?.width||B,B);
 const line=(x,y,w,color,width=1)=>ops.push(()=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.stroke();});
 const flower=(x,y)=>{if(!d.flowers)return;ops.push(()=>{ctx.fillStyle=c.decoration;for(let a=0;a<5;a++){ctx.beginPath();ctx.ellipse(x+6*Math.cos(a*Math.PI*2/5),y+6*Math.sin(a*Math.PI*2/5),4,5,a*Math.PI*2/5,0,Math.PI*2);ctx.fill();}ctx.fillStyle=c.background;ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();});};
 if(logo){const logoStart=ops.length,logoTop=y;const scale=Math.min(d.logoSize/logo.width,d.logoSize/logo.height),w=logo.width*scale,h=logo.height*scale;ops.push(()=>ctx.drawImage(logo,(W-w)/2,logoTop,w,h));mark('brand:logo',rect((W-w)/2,logoTop,w,h),{type:'logo'},logoStart,'매장 로고','image');y+=h+18;}else y+=8;
 if(p.brand.name.trim())y=brandBlock('name',y,`400 26px ${d.font}`,33,c.heading)+6;
 if(p.brand.title.trim())y=brandBlock('title',y,'16px sans-serif',25,c.heading)+1;y+=14;
 if(elements.length){const top=Math.min(...elements.map(e=>e.y)),bottom=Math.max(...elements.map(e=>e.y+e.height));mark('brand:header',rect(m,top,B,bottom-top),{type:'brandGroup'},0,'매장 정보','group');}
 const metrics=(font,value='가나다 0123456789')=>{ctx.font=font;const mt=ctx.measureText(value),size=Number(font.match(/([\d.]+)px/)?.[1])||14;return {ascent:mt.actualBoundingBoxAscent??size*.8,descent:mt.actualBoundingBoxDescent??size*.2};};
 function section(s,x,top,width){
  const start=ops.length,style=s.style||{},sc={heading:style.heading||c.category,body:style.body||c.body,price:style.price||c.price,note:style.note||c.note,line:style.line||c.line,tableHeader:style.tableHeader||c.tableHeader||c.body};
  const pad=d.sectionPadding??24,inner=width-pad*2,xx=x+pad;let yy=top;
  const block=(value,left,at,w,font,step,color,id,binding,label,align='left')=>{
   const begin=ops.length,maxWidth=w,st=p.canvas?.styles?.[id]||{};w=Math.min(st.width||w,w);
   const layout=layoutText(ctx,value,w,font,step,st),x=align==='right'?left-w:align==='center'?left-w/2:left;
   const anchor=align==='right'?x+w-layout.padding:align==='center'?x+w/2:x+layout.padding;
   layout.lines.forEach((v,i)=>text(v,anchor,at+layout.padding+layout.ascent+i*layout.step,layout.font,color,align,layout.inner));
   mark(id,rect(x,at,w,layout.height),binding,begin,label,'text',maxWidth);return at+layout.height;
  };
  if(!s.title.trim())error='섹션 제목을 입력해 주세요.';
  const titleId='sec:'+s.id+':title',headingSize=p.canvas?.styles?.[titleId]?.fontSize||d.headingSize,headingFont=`400 ${headingSize}px ${d.font}`,titleLines=wrap(s.title,Math.min(p.canvas?.styles?.[titleId]?.width||inner,inner),headingFont),titleMetrics=metrics(headingFont,titleLines[0]||'가');
  // Use the actual first line's ink center for the ornament and title baseline.
  flower(x+8,yy+(titleMetrics.ascent+titleMetrics.descent)/2);
  const headingTop=yy;
  yy=block(s.title,xx,yy,inner,headingFont,Math.ceil(headingSize*1.22),sc.heading,titleId,{type:'section',sectionId:s.id,key:'title'},s.title+' 제목');
  const noteFont=`${d.bodySize-1}px sans-serif`,noteText='/ '+s.note;ctx.font=headingFont;ctx.letterSpacing='0px';const headingWidth=ctx.measureText(s.title).width,noteX=xx+headingWidth+18;ctx.font=noteFont;
  const inlineNote=!p.canvas?.styles?.[titleId]&&!p.canvas?.styles?.['sec:'+s.id+':note']&&s.kind==='matrix'&&!!s.note&&titleLines.length===1&&ctx.measureText(noteText).width<=xx+inner-noteX;
  if(inlineNote){const titleBox=elements.find(e=>e.id===titleId);titleBox.width=Math.min(titleBox.width,headingWidth+4);const mt=metrics(noteFont,noteText),noteHeight=mt.ascent+mt.descent,noteTop=headingTop+(titleMetrics.ascent+titleMetrics.descent-noteHeight)/2;yy=Math.max(yy,block(noteText,noteX,noteTop,xx+inner-noteX,noteFont,d.bodySize+4,sc.note,'sec:'+s.id+':note',{type:'section',sectionId:s.id,key:'note'},s.title+' 안내'));}
  yy+=s.breeds?2:8;
  if(s.breeds)yy=block(s.breeds,xx,yy,inner,`${d.bodySize-1}px sans-serif`,d.bodySize+5,sc.body,'sec:'+s.id+':breeds',{type:'section',sectionId:s.id,key:'breeds'},s.title+' 견종 설명');
  if(s.kind==='matrix'){
   if(p.columns.some(col=>!col.name.trim()))error='서비스 열 이름을 입력해 주세요.';
   if(s.note&&!inlineNote){yy+=3;yy=block(s.note,xx,yy,inner,noteFont,d.bodySize+4,sc.note,'sec:'+s.id+':note',{type:'section',sectionId:s.id,key:'note'},s.title+' 안내');}
   yy+=10;const tableStart=ops.length,tableTop=yy,weightWidth=112,cw=(inner-weightWidth)/p.columns.length;
   const cells=[{value:'몸무게',x:xx,w:weightWidth},...p.columns.map((col,j)=>({value:(col.note?'('+col.note+')\n':'')+col.name,x:xx+weightWidth+cw*j,w:cw,id:'sec:'+s.id+':col:'+col.id,binding:{type:'column',sectionId:s.id,columnId:col.id,key:'name'},label:col.name+' 열 제목'}))];
   for(const cell of cells)cell.layout=layoutText(ctx,cell.value,cell.w-8,`${d.bodySize}px sans-serif`,d.bodySize+4,p.canvas?.styles?.[cell.id]||{});
   const headHeight=Math.max(...cells.map(cell=>cell.layout.height))+10;
   for(const cell of cells){const begin=ops.length,l=cell.layout;l.lines.forEach((v,i)=>text(v,cell.x+cell.w/2,yy+(headHeight-l.height)/2+l.padding+l.ascent+i*l.step,l.font,sc.tableHeader,'center',l.inner));if(cell.id)mark(cell.id,rect(cell.x,yy,cell.w,headHeight),cell.binding,begin,cell.label);}
   yy+=headHeight;line(xx,yy,inner,sc.line,.9);yy+=5;
   for(const r of s.rows){
    if(!r.weight.trim())error='몸무게 행 이름을 입력해 주세요.';
    const rowCells=[{value:r.weight,x:xx,w:weightWidth,id:'sec:'+s.id+':row:'+r.id,binding:{type:'weight',sectionId:s.id,rowId:r.id},label:s.title+' '+r.weight,font:`${d.bodySize}px sans-serif`,color:sc.body},...r.prices.map((v,j)=>{const empty=v.trim()==='',n=Number(v);if(!empty&&Number.isFinite(n)&&(!Number.isInteger(n)||n<0||n>100000000))error='금액 범위를 확인해 주세요.';return {value:empty?'—':Number.isFinite(n)?n.toLocaleString('ko-KR'):v,x:xx+weightWidth+cw*j,w:cw,id:'sec:'+s.id+':cell:'+r.id+':'+p.columns[j].id,binding:{type:'price',sectionId:s.id,rowId:r.id,columnId:p.columns[j].id},label:s.title+' '+r.weight+' '+p.columns[j].name+' 가격',font:`600 ${d.priceSize}px sans-serif`,color:sc.price};})];
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
    const font=(size,st,bold=false)=>`${st.italic?'italic ':''}${st.bold===undefined?(bold?'600':'400'):st.bold?'700':'400'} ${size}px sans-serif`;
    let labelFont=font(labelSize,ls),priceFont=font(priceSize,vs,true);
    ctx.font=labelFont;ctx.letterSpacing=(ls.letterSpacing||0)+'px';let labelNatural=ctx.measureText(item.label).width+2;ctx.font=priceFont;ctx.letterSpacing=(vs.letterSpacing||0)+'px';let valueNatural=ctx.measureText(item.value||'—').width+4;
    // Keep ordinary compound labels and amounts on one line when a small,
    // proportional font adjustment is enough. Explicit font settings win.
    if(!ls.padding&&!vs.padding&&!ls.letterSpacing&&!vs.letterSpacing&&!ls.lineHeight&&!vs.lineHeight&&!ls.width&&!ls.fontSize&&!vs.fontSize&&!item.label.includes('\n')&&!item.value.includes('\n')){
     const fit=Math.min(1,(inner-gap)/(labelNatural+valueNatural));
     if(labelSize*fit>=11&&priceSize*fit>=11){labelSize*=fit;priceSize*=fit;labelFont=font(labelSize,ls);priceFont=font(priceSize,vs,true);ctx.font=labelFont;labelNatural=ctx.measureText(item.label).width+2;ctx.font=priceFont;valueNatural=ctx.measureText(item.value||'—').width+4;}
    }
    const nameWidth=ls.width?Math.max(40,Math.min(ls.width,maxNameWidth)):Math.max(40,inner-Math.min(inner*.55,Math.max(64,valueNatural))-gap),valueWidth=inner-nameWidth-gap;
    const labelLayout=layoutText(ctx,item.label,nameWidth,labelFont,labelSize+5,ls),valueLayout=layoutText(ctx,item.value||'—',valueWidth,priceFont,priceSize+4,vs),rh=Math.max(30,labelLayout.height+12,valueLayout.height+12);
    let begin=ops.length,l=labelLayout;l.lines.forEach((v,i)=>text(v,xx+l.padding,yy+(rh-l.height)/2+l.padding+(l.step-l.ascent-l.descent)/2+l.ascent+i*l.step,l.font,sc.body,'left',l.inner));mark(labelId,rect(xx,yy,nameWidth,rh),{type:'item',sectionId:s.id,index,key:'label'},begin,item.label+' 항목','text',maxNameWidth);
    begin=ops.length;l=valueLayout;l.lines.forEach((v,i)=>text(v,x+width-pad-l.padding,yy+(rh-l.height)/2+l.padding+(l.step-l.ascent-l.descent)/2+l.ascent+i*l.step,l.font,sc.price,'right',l.inner));mark(valueId,rect(x+width-pad-valueWidth,yy,valueWidth,rh),{type:'item',sectionId:s.id,index,key:'value'},begin,item.label+' 금액');yy+=rh;
   }
  }
  if(s.kind==='text'&&s.content){yy+=4;yy=block(s.content,xx,yy,inner,`${d.bodySize}px sans-serif`,d.bodySize+7,sc.body,'sec:'+s.id+':content',{type:'section',sectionId:s.id,key:'content'},s.title+' 내용');}
  if(s.note&&s.kind!=='matrix'){yy+=8;yy=block(s.note,xx,yy,inner,`${d.bodySize-1}px sans-serif`,d.bodySize+5,sc.note,'sec:'+s.id+':note',{type:'section',sectionId:s.id,key:'note'},s.title+' 안내');}
  if(s.kind!=='text'&&s.content){yy+=8;yy=block(s.content,xx,yy,inner,`${d.bodySize}px sans-serif`,d.bodySize+7,sc.body,'sec:'+s.id+':content',{type:'section',sectionId:s.id,key:'content'},s.title+' 내용');}
  yy+=10;const h=yy-top;
  ops.splice(start,0,()=>{if(style.background){ctx.fillStyle=style.background;ctx.fillRect(x,top-8,width,h+8);}if(style.border&&style.border!=='none'){ctx.save();ctx.strokeStyle=sc.line;ctx.lineWidth=style.borderWidth||1;if(style.border==='dashed')ctx.setLineDash([5,4]);ctx.strokeRect(x,top-8,width,h+8);ctx.restore();}});
  mark('sec:'+s.id,rect(x,top-8,width,h+8),{type:'sectionGroup',sectionId:s.id},start,s.title+' 섹션','group');boxes.push({id:s.id,x,y:top-8,width,height:h+8});return yy;
 }
 const visible=p.sections.filter(s=>s.visible);for(let i=0;i<visible.length;i++){const s=visible[i];if(s.span==='half'&&s.kind!=='matrix'&&visible[i+1]?.span==='half'&&visible[i+1].kind!=='matrix'){const gutter=d.columnGap??24,width=(B-gutter)/2;y=Math.max(section(s,m,y,width),section(visible[++i],m+width+gutter,y,width))+d.gap;}else y=section(s,m,y,B)+d.gap;}
 if(visible.length)y+=16-d.gap;
 if(!visible.length)error='표시할 섹션을 하나 이상 선택해 주세요.';
 const footerStart=ops.length,footerElementStart=elements.length;
 if(p.brand.footer)y=brandBlock('footer',y,'12px sans-serif',20,c.note,'left');
 if(p.brand.contact)y=brandBlock('contact',y+16,'13px sans-serif',21,c.body);
 if(elements.length>footerElementStart){const items=elements.slice(footerElementStart),top=Math.min(...items.map(e=>e.y)),bottom=Math.max(...items.map(e=>e.y+e.height));mark('brand:footerGroup',rect(m,top,B,bottom-top),{type:'brandGroup'},footerStart,'하단 안내','group');}
 const byId=new Map(elements.map(e=>[e.id,e]));
 const chains=new Map();for(const e of elements){const op=ops.find(op=>op.owners?.includes(e.id));const chain=op?.owners?.slice(0,op.owners.indexOf(e.id)+1)||[e.id];chains.set(e.id,chain);}
 const matrixFor=chain=>{let scale=1,dx=0,dy=0;for(const id of chain){const e=byId.get(id),tr=p.canvas?.transforms?.[id];if(!e||!tr)continue;dx+=scale*(e.x+tr.x-e.x*tr.scale);dy+=scale*(e.y+tr.y-e.y*tr.scale);scale*=tr.scale;}return {scale,dx,dy};};
 let positioned=elements.map(e=>{const chain=chains.get(e.id),tr=matrixFor(chain),parent=matrixFor(chain.slice(0,-1));return {...e,base:{x:e.x,y:e.y,width:e.width,height:e.height},x:e.x*tr.scale+tr.dx,y:e.y*tr.scale+tr.dy,width:e.width*tr.scale,height:e.height*tr.scale,parentScale:parent.scale,owners:chain,textStyle:ops.find(op=>op.element===e.id&&op.textStyle)?.textStyle};});
 const extent=Math.max(y,...positioned.map(e=>e.y+e.height));
 if(positioned.some(e=>e.x<-.5||e.y<-.5||e.x+e.width>W+.5))error='화면 밖으로 나간 요소를 안쪽으로 이동하거나 자동 정렬해 주세요.';
 const required=Math.ceil(extent+40),H=options.fixedHeight||Math.max(900,required);
 // Fit the complete composition inside one sheet. The paper and its border never scale.
 const safe=Math.max(36,d.borderInset+14),top=Math.min(safe,...positioned.map(e=>e.y)),bottom=Math.max(extent,...positioned.map(e=>e.y+e.height));
 const fitScale=options.fitToPage?Math.min(1,(H-safe*2)/(bottom-top)):1,fitX=(W-W*fitScale)/2,fitY=fitScale<1?safe-top*fitScale:0;
 const fitted=e=>({...e,x:e.x*fitScale+fitX,y:e.y*fitScale+fitY,width:e.width*fitScale,height:e.height*fitScale,...(e.parentScale===undefined?{}:{parentScale:e.parentScale*fitScale})});
 if(fitScale<1){positioned=positioned.map(fitted);for(let i=0;i<boxes.length;i++)boxes[i]=fitted(boxes[i]);}
 if(required>H&&!options.fitToPage)error='요소가 A4 영역을 넘어요. 배치를 자동 정렬하거나 크기를 줄여 주세요.';if(H>6000)error='내용이 너무 길어요. 섹션을 나누거나 줄여 주세요.';
 if(options.measureOnly)return {error,requiredHeight:required,elements:positioned,width:W,height:H,fitScale};
 canvas.width=W*2;canvas.height=Math.min(H,6000)*2;ctx.setTransform(2,0,0,2,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.lang='ko';ctx.fontKerning='none';ctx.textRendering='geometricPrecision';ctx.fillStyle=c.background;ctx.fillRect(0,0,W,H);
 const inset=d.borderInset;if(d.border!=='none'){ctx.strokeStyle=c.line;ctx.lineWidth=d.borderWidth;if(d.border==='scallop'){ctx.beginPath();ctx.moveTo(inset,inset);for(let x=inset;x<W-inset;x+=22)ctx.quadraticCurveTo(Math.min(x+11,W-inset),inset+6,Math.min(x+22,W-inset),inset);for(let y=inset;y<H-inset;y+=22)ctx.quadraticCurveTo(W-inset-6,Math.min(y+11,H-inset),W-inset,Math.min(y+22,H-inset));for(let x=W-inset;x>inset;x-=22)ctx.quadraticCurveTo(Math.max(x-11,inset),H-inset-6,Math.max(x-22,inset),H-inset);for(let y=H-inset;y>inset;y-=22)ctx.quadraticCurveTo(inset+6,Math.max(y-11,inset),inset,Math.max(y-22,inset));ctx.closePath();ctx.stroke();}else{ctx.strokeRect(inset,inset,W-inset*2,H-inset*2);if(d.border==='double'){ctx.lineWidth=d.borderWidth*.6;ctx.strokeRect(inset+7,inset+7,W-inset*2-14,H-inset*2-14);}}}
 if(d.corners){ctx.fillStyle=c.decoration;for(const [x,y,angle] of [[34,34,0],[W-34,34,Math.PI/2],[W-34,H-34,Math.PI],[34,H-34,-Math.PI/2]]){ctx.save();ctx.translate(x,y);ctx.rotate(angle);for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(8+i*6,15-i*4,3,6,-.7,0,Math.PI*2);ctx.fill();}ctx.restore();}}
 ctx.save();ctx.translate(fitX,fitY);ctx.scale(fitScale,fitScale);
 for(const op of ops){ctx.save();const tr=matrixFor(op.owners||[]);ctx.translate(tr.dx,tr.dy);ctx.scale(tr.scale,tr.scale);op();ctx.restore();}ctx.restore();return {error,boxes,elements:positioned,width:W,height:Math.min(H,6000),requiredHeight:required,fitScale};
}
