export function renderPoster(canvas,p,logo,options={}){
 canvas.lang='ko';
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),W=900,m=48,B=W-m*2,d=p.design,c=d.colors,ops=[],boxes=[],elements=[];let y=36,error='';
 ctx.lang='ko';ctx.fontKerning='none';ctx.textRendering='geometricPrecision';
 const text=(v,x,y,font,color,align='left',width)=>{const op=()=>{const style=p.canvas?.styles?.[op.element]||{},size=style.fontSize||Number(font.match(/([\d.]+)px/)?.[1])||14;ctx.font=`${style.italic?'italic ':''}${style.bold===undefined?(font.startsWith('600')?'600':'400'):style.bold?'700':'400'} ${size}px ${font.includes('Jua')?'Jua':'sans-serif'}`;ctx.fillStyle=style.color||color;ctx.textAlign=style.align||align;let anchor=x;if(style.align&&style.align!==align){const e=elements.find(e=>e.id===op.element);if(e)anchor=style.align==='left'?e.x+3:style.align==='right'?e.x+e.width-3:e.x+e.width/2;}ctx.fillText(v,anchor,y,width||W);if(style.underline){const measured=Math.min(ctx.measureText(v).width,width||W);const left=ctx.textAlign==='center'?anchor-measured/2:ctx.textAlign==='right'?anchor-measured:anchor;ctx.fillRect(left,y+3,measured,Math.max(1,size/16));}};op.textStyle={color,fontSize:Number(font.match(/([\d.]+)px/)?.[1])||14,align};ops.push(op);};
 const tag=(start,id)=>{for(let i=start;i<ops.length;i++){ops[i].owners=[id,...(ops[i].owners||[])];if(!ops[i].element)ops[i].element=id;}};
 const mark=(id,rect,binding,start,label,kind='text')=>{tag(start,id);elements.push({id,...rect,binding,label,kind});};
 const rect=(x,y,width,height)=>({x,y,width,height});
 const wrap=(s,width,font)=>{
  ctx.font=font;const result=[];
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
 const lines=(s,x,y,width,font,step,color,align='left')=>{const a=wrap(s,width,font);a.forEach((v,i)=>text(v,x,y+i*step,font,color,align,width));return a.length*step;};
 const line=(x,y,w,color,width=1)=>ops.push(()=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.stroke();});
 const flower=(x,y)=>{if(!d.flowers)return;ops.push(()=>{ctx.fillStyle=c.decoration;for(let a=0;a<5;a++){ctx.beginPath();ctx.ellipse(x+6*Math.cos(a*Math.PI*2/5),y+6*Math.sin(a*Math.PI*2/5),4,5,a*Math.PI*2/5,0,Math.PI*2);ctx.fill();}ctx.fillStyle=c.background;ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();});};
 if(logo){const logoStart=ops.length;const scale=Math.min(d.logoSize/logo.width,d.logoSize/logo.height),w=logo.width*scale,h=logo.height*scale;ops.push(()=>ctx.drawImage(logo,(W-w)/2,36,w,h));mark('brand:logo',rect((W-w)/2,36,w,h),{type:'logo'},logoStart,'매장 로고','image');y+=h+18;}else y+=8;
 {const start=ops.length;text(p.brand.name||'우리 가게',W/2,y+18,`400 26px ${d.font}`,c.heading,'center',B);mark('brand:name',rect(m,y-10,B,37),{type:'brand',key:'name'},start,'매장 이름');}y+=39;
 if(p.brand.title){const start=ops.length;text(p.brand.title,W/2,y+4,`16px sans-serif`,c.heading,'center',B);mark('brand:title',rect(m,y-15,B,25),{type:'brand',key:'title'},start,'요금표 제목');y+=26;}y+=14;
 {const top=Math.min(...elements.map(e=>e.y)),bottom=Math.max(...elements.map(e=>e.y+e.height));mark('brand:header',rect(m,top,B,bottom-top),{type:'brandGroup'},0,'매장 정보','group');}
 const metrics=(font,value='가나다 0123456789')=>{ctx.font=font;const mt=ctx.measureText(value),size=Number(font.match(/([\d.]+)px/)?.[1])||14;return {ascent:mt.actualBoundingBoxAscent??size*.8,descent:mt.actualBoundingBoxDescent??size*.2};};
 function section(s,x,top,width){
  const start=ops.length,style=s.style||{},sc={heading:style.heading||c.category,body:style.body||c.body,price:style.price||c.price,note:style.note||c.note,line:style.line||c.line,tableHeader:style.tableHeader||c.tableHeader||c.body};
  const pad=24,inner=width-pad*2,xx=x+pad;let yy=top;
  const block=(value,left,at,w,font,step,color,id,binding,label,align='left')=>{const begin=ops.length,a=wrap(value,w,font),mt=metrics(font,a[0]||'가'),height=Math.max(step,a.length*step);a.forEach((v,i)=>text(v,left,at+mt.ascent+i*step,font,color,align,w));mark(id,rect(align==='right'?left-w:align==='center'?left-w/2:left,at,w,height),binding,begin,label);return at+height;};
  if(!s.title.trim())error='섹션 제목을 입력해 주세요.';
  const titleId='sec:'+s.id+':title',headingSize=p.canvas?.styles?.[titleId]?.fontSize||d.headingSize,headingFont=`400 ${headingSize}px ${d.font}`,titleLines=wrap(s.title,inner,headingFont),titleMetrics=metrics(headingFont,titleLines[0]||'가');
  // Use the actual first line's ink center for the ornament and title baseline.
  flower(x+8,yy+(titleMetrics.ascent+titleMetrics.descent)/2);
  const headingTop=yy;
  yy=block(s.title,xx,yy,inner,headingFont,Math.ceil(headingSize*1.22),sc.heading,titleId,{type:'section',sectionId:s.id,key:'title'},s.title+' 제목');
  const noteFont=`${d.bodySize-1}px sans-serif`,noteText='/ '+s.note;ctx.font=headingFont;const headingWidth=ctx.measureText(s.title).width,noteX=xx+headingWidth+18;ctx.font=noteFont;
  const inlineNote=s.kind==='matrix'&&!!s.note&&titleLines.length===1&&ctx.measureText(noteText).width<=xx+inner-noteX;
  if(inlineNote){const mt=metrics(noteFont,noteText),noteHeight=mt.ascent+mt.descent,noteTop=headingTop+(titleMetrics.ascent+titleMetrics.descent-noteHeight)/2;block(noteText,noteX,noteTop,xx+inner-noteX,noteFont,d.bodySize+4,sc.note,'sec:'+s.id+':note',{type:'section',sectionId:s.id,key:'note'},s.title+' 안내');}
  yy+=8;
  if(s.breeds)yy=block(s.breeds,xx,yy,inner,`${d.bodySize-1}px sans-serif`,d.bodySize+5,sc.body,'sec:'+s.id+':breeds',{type:'section',sectionId:s.id,key:'breeds'},s.title+' 견종 설명');
  if(s.kind==='matrix'){
   if(s.note&&!inlineNote){yy+=3;yy=block(s.note,xx,yy,inner,noteFont,d.bodySize+4,sc.note,'sec:'+s.id+':note',{type:'section',sectionId:s.id,key:'note'},s.title+' 안내');}
   yy+=10;const tableStart=ops.length,tableTop=yy,weightWidth=112,cw=(inner-weightWidth)/p.columns.length,noteSize=Math.max(9,d.bodySize-3),noteFont=`${noteSize}px sans-serif`,headFont=`${d.bodySize}px sans-serif`,headLines=p.columns.map(col=>wrap(col.name,cw-8,headFont));
   const noteHeight=p.columns.some(col=>col.note)?noteSize+5:0,nameHeight=Math.max(...headLines.map(a=>a.length),1)*(d.bodySize+4),headHeight=noteHeight+nameHeight+10;
   const drawHeader=(value,cx,parts,id,binding,label,note='')=>{const begin=ops.length;if(note)text(`(${note})`,cx,yy+metrics(noteFont).ascent,noteFont,sc.tableHeader,'center',cw-8);const baseline=yy+noteHeight+(nameHeight-parts.length*(d.bodySize+4))/2+metrics(headFont).ascent;parts.forEach((v,i)=>text(v,cx,baseline+i*(d.bodySize+4),headFont,sc.tableHeader,'center',id?cw-8:weightWidth-8));if(id)mark(id,rect(cx-cw/2,yy,cw,headHeight),binding,begin,label);};
   drawHeader('몸무게',xx+weightWidth/2,['몸무게']);
   p.columns.forEach((col,j)=>{if(!col.name.trim())error='서비스 열 이름을 입력해 주세요.';drawHeader(col.name,xx+weightWidth+cw*(j+.5),headLines[j],'sec:'+s.id+':col:'+col.id,{type:'column',sectionId:s.id,columnId:col.id,key:'name'},col.name+' 열 제목',col.note);});
   yy+=headHeight;line(xx,yy,inner,sc.line,.9);yy+=5;
   for(const r of s.rows){
    if(!r.weight.trim())error='몸무게 행 이름을 입력해 주세요.';
    const weightFont=`${d.bodySize}px sans-serif`,priceFont=`600 ${d.priceSize}px sans-serif`,a=wrap(r.weight,weightWidth-8,weightFont),weightMetrics=metrics(weightFont,a[0]),priceMetrics=metrics(priceFont,'0123456789'),weightHeight=(a.length-1)*(d.bodySize+4)+weightMetrics.ascent+weightMetrics.descent,rh=Math.max(d.rowHeight,weightHeight+12,priceMetrics.ascent+priceMetrics.descent+12);
    const begin=ops.length,weightBaseline=yy+(rh-weightHeight)/2+weightMetrics.ascent;
    a.forEach((v,i)=>text(v,xx+weightWidth/2,weightBaseline+i*(d.bodySize+4),weightFont,sc.body,'center',weightWidth-8));mark('sec:'+s.id+':row:'+r.id,rect(xx,yy,weightWidth,rh),{type:'weight',sectionId:s.id,rowId:r.id},begin,s.title+' '+r.weight);
    r.prices.forEach((v,j)=>{const empty=v.trim()==='',n=Number(v);if(!empty&&Number.isFinite(n)&&(!Number.isInteger(n)||n<0||n>100000000))error='금액은 0~100,000,000원의 정수로 입력해 주세요.';const begin=ops.length;text(empty?'—':Number.isFinite(n)?n.toLocaleString('ko-KR'):v,xx+weightWidth+cw*(j+.5),yy+(rh-priceMetrics.ascent-priceMetrics.descent)/2+priceMetrics.ascent,priceFont,sc.price,'center',cw-8);mark('sec:'+s.id+':cell:'+r.id+':'+p.columns[j].id,rect(xx+weightWidth+cw*j,yy,cw,rh),{type:'price',sectionId:s.id,rowId:r.id,columnId:p.columns[j].id},begin,s.title+' '+r.weight+' '+p.columns[j].name+' 가격');});yy+=rh;
   }
   mark('sec:'+s.id+':table',rect(xx,tableTop,inner,yy-tableTop),{type:'table',sectionId:s.id},tableStart,s.title+' 가격표','group');
  }
  if(s.kind==='list'||s.kind==='matrix'&&s.items?.length){
   yy+=6;
   // A shared value column keeps all amounts right aligned without squeezing labels.
   const priceFont=`600 ${d.priceSize}px sans-serif`,labelFont=`${d.bodySize}px sans-serif`;ctx.font=priceFont;
   const valueWidth=Math.min(inner*.55,Math.max(88,...s.items.map(item=>ctx.measureText(item.value||'—').width+4))),nameWidth=inner-valueWidth-16;
   for(const [localIndex,item] of s.items.entries()){
    const index=localIndex+(s._itemOffset||0),labels=wrap(item.label,nameWidth,labelFont),values=wrap(item.value||'—',valueWidth,priceFont),lm=metrics(labelFont,labels[0]),vm=metrics(priceFont,values[0]),labelHeight=(labels.length-1)*(d.bodySize+5)+lm.ascent+lm.descent,valueHeight=(values.length-1)*(d.priceSize+4)+vm.ascent+vm.descent,rh=Math.max(30,labelHeight+12,valueHeight+12);
    let begin=ops.length;labels.forEach((v,i)=>text(v,xx,yy+(rh-labelHeight)/2+lm.ascent+i*(d.bodySize+5),labelFont,sc.body,'left',nameWidth));mark('sec:'+s.id+':item:'+index+':label',rect(xx,yy,nameWidth,rh),{type:'item',sectionId:s.id,index,key:'label'},begin,item.label+' 항목');
    begin=ops.length;values.forEach((v,i)=>text(v,x+width-pad,yy+(rh-valueHeight)/2+vm.ascent+i*(d.priceSize+4),priceFont,sc.price,'right',valueWidth));mark('sec:'+s.id+':item:'+index+':value',rect(x+width-pad-valueWidth,yy,valueWidth,rh),{type:'item',sectionId:s.id,index,key:'value'},begin,item.label+' 금액');yy+=rh;
   }
  }
  if(s.kind==='text'&&s.content){yy+=4;yy=block(s.content,xx,yy,inner,`${d.bodySize}px sans-serif`,d.bodySize+7,sc.body,'sec:'+s.id+':content',{type:'section',sectionId:s.id,key:'content'},s.title+' 내용');}
  if(s.note&&s.kind!=='matrix'){yy+=8;yy=block(s.note,xx,yy,inner,`${d.bodySize-1}px sans-serif`,d.bodySize+5,sc.note,'sec:'+s.id+':note',{type:'section',sectionId:s.id,key:'note'},s.title+' 안내');}
  if(s.kind!=='text'&&s.content){yy+=8;yy=block(s.content,xx,yy,inner,`${d.bodySize}px sans-serif`,d.bodySize+7,sc.body,'sec:'+s.id+':content',{type:'section',sectionId:s.id,key:'content'},s.title+' 내용');}
  yy+=10;const h=yy-top;
  ops.splice(start,0,()=>{if(style.background){ctx.fillStyle=style.background;ctx.fillRect(x,top-8,width,h+8);}if(style.border&&style.border!=='none'){ctx.save();ctx.strokeStyle=sc.line;ctx.lineWidth=style.borderWidth||1;if(style.border==='dashed')ctx.setLineDash([5,4]);ctx.strokeRect(x,top-8,width,h+8);ctx.restore();}});
  mark('sec:'+s.id,rect(x,top-8,width,h+8),{type:'sectionGroup',sectionId:s.id},start,s.title+' 섹션','group');boxes.push({id:s.id,x,y:top-8,width,height:h+8});return yy;
 }
 const visible=p.sections.filter(s=>s.visible);for(let i=0;i<visible.length;i++){const s=visible[i];if(s.span==='half'&&s.kind!=='matrix'&&visible[i+1]?.span==='half'&&visible[i+1].kind!=='matrix'){const width=(B-24)/2;y=Math.max(section(s,m,y,width),section(visible[++i],m+width+24,y,width))+d.gap;}else y=section(s,m,y,B)+d.gap;}
 if(visible.length)y+=16-d.gap;
 if(!visible.length)error='표시할 섹션을 하나 이상 선택해 주세요.';
 const footerStart=ops.length,footerElementStart=elements.length;
 if(p.brand.footer){const start=ops.length,top=y-14,hh=lines(p.brand.footer,m,y,B,'12px sans-serif',20,c.note);mark('brand:footer',rect(m,top,B,hh),{type:'brand',key:'footer'},start,'하단 안내');y+=hh;}
 if(p.brand.contact){y+=16;const start=ops.length,top=y-15,hh=lines(p.brand.contact,W/2,y,B,'13px sans-serif',21,c.body,'center');mark('brand:contact',rect(m,top,B,hh),{type:'brand',key:'contact'},start,'매장 연락처');y+=hh;}
 if(elements.length>footerElementStart){const items=elements.slice(footerElementStart),top=Math.min(...items.map(e=>e.y)),bottom=Math.max(...items.map(e=>e.y+e.height));mark('brand:footerGroup',rect(m,top,B,bottom-top),{type:'brandGroup'},footerStart,'하단 안내','group');}
 const byId=new Map(elements.map(e=>[e.id,e]));
 const chains=new Map();for(const e of elements){const op=ops.find(op=>op.owners?.includes(e.id));const chain=op?.owners?.slice(0,op.owners.indexOf(e.id)+1)||[e.id];chains.set(e.id,chain);}
 const matrixFor=chain=>{let scale=1,dx=0,dy=0;for(const id of chain){const e=byId.get(id),tr=p.canvas?.transforms?.[id];if(!e||!tr)continue;dx+=scale*(e.x+tr.x-e.x*tr.scale);dy+=scale*(e.y+tr.y-e.y*tr.scale);scale*=tr.scale;}return {scale,dx,dy};};
 const positioned=elements.map(e=>{const chain=chains.get(e.id),tr=matrixFor(chain),parent=matrixFor(chain.slice(0,-1));return {...e,base:{x:e.x,y:e.y,width:e.width,height:e.height},x:e.x*tr.scale+tr.dx,y:e.y*tr.scale+tr.dy,width:e.width*tr.scale,height:e.height*tr.scale,parentScale:parent.scale,owners:chain,textStyle:ops.find(op=>op.element===e.id&&op.textStyle)?.textStyle};});
 const extent=Math.max(y,...positioned.map(e=>e.y+e.height));
 if(positioned.some(e=>e.x<-.5||e.y<-.5||e.x+e.width>W+.5))error='화면 밖으로 나간 요소를 안쪽으로 이동하거나 자동 정렬해 주세요.';
 const required=Math.ceil(extent+40),H=options.fixedHeight||Math.max(900,required);if(required>H)error='요소가 A4 영역을 넘어요. 배치를 자동 정렬하거나 크기를 줄여 주세요.';if(H>6000)error='내용이 너무 길어요. 섹션을 나누거나 줄여 주세요.';
 if(options.measureOnly)return {error,requiredHeight:required,elements:positioned,width:W,height:H};
 canvas.width=W*2;canvas.height=Math.min(H,6000)*2;ctx.setTransform(2,0,0,2,0,0);ctx.lang='ko';ctx.fontKerning='none';ctx.textRendering='geometricPrecision';ctx.fillStyle=c.background;ctx.fillRect(0,0,W,H);
 const inset=d.borderInset;if(d.border!=='none'){ctx.strokeStyle=c.line;ctx.lineWidth=d.borderWidth;if(d.border==='scallop'){ctx.beginPath();ctx.moveTo(inset,inset);for(let x=inset;x<W-inset;x+=22)ctx.quadraticCurveTo(Math.min(x+11,W-inset),inset+6,Math.min(x+22,W-inset),inset);for(let y=inset;y<H-inset;y+=22)ctx.quadraticCurveTo(W-inset-6,Math.min(y+11,H-inset),W-inset,Math.min(y+22,H-inset));for(let x=W-inset;x>inset;x-=22)ctx.quadraticCurveTo(Math.max(x-11,inset),H-inset-6,Math.max(x-22,inset),H-inset);for(let y=H-inset;y>inset;y-=22)ctx.quadraticCurveTo(inset+6,Math.max(y-11,inset),inset,Math.max(y-22,inset));ctx.closePath();ctx.stroke();}else{ctx.strokeRect(inset,inset,W-inset*2,H-inset*2);if(d.border==='double'){ctx.lineWidth=d.borderWidth*.6;ctx.strokeRect(inset+7,inset+7,W-inset*2-14,H-inset*2-14);}}}
 if(d.corners){ctx.fillStyle=c.decoration;for(const [x,y,angle] of [[34,34,0],[W-34,34,Math.PI/2],[W-34,H-34,Math.PI],[34,H-34,-Math.PI/2]]){ctx.save();ctx.translate(x,y);ctx.rotate(angle);for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(8+i*6,15-i*4,3,6,-.7,0,Math.PI*2);ctx.fill();}ctx.restore();}}
 for(const op of ops){ctx.save();const tr=matrixFor(op.owners||[]);ctx.translate(tr.dx,tr.dy);ctx.scale(tr.scale,tr.scale);op();ctx.restore();}return {error,boxes,elements:positioned,width:W,height:Math.min(H,6000),requiredHeight:required};
}
