// A single measurement path for preview, selection bounds and exported pixels.
export function layoutText(ctx,value,width,baseFont,baseStep,style={}){
 const size=style.fontSize||Number(baseFont.match(/([\d.]+)px/)?.[1])||14;
 const bold=style.bold===undefined?/^(600|700)/.test(baseFont):style.bold;
 const font=`${style.italic?'italic ':''}${bold?(style.bold?'700':'600'):'400'} ${size}px ${style.fontFamily||(baseFont.includes('Jua')?'Jua':'StudioSans')}`;
 const padding=Math.min(style.padding||0,Math.max(0,(width-16)/2));
 const inner=Math.max(8,width-2*padding),spacing=style.letterSpacing||0;
 ctx.font=font;ctx.letterSpacing=spacing+'px';
 const lines=[];
 for(const paragraph of String(value).split('\n')){
  let row='';
  for(const token of paragraph.match(/\S+\s*/g)||[]){
   if(row&&ctx.measureText(row+token.trimEnd()).width>inner){lines.push(row.trimEnd());row='';}
   for(const char of token){if(!row&&/\s/.test(char))continue;if(row&&ctx.measureText(row+char).width>inner){lines.push(row.trimEnd());row='';}row+=char;}
  }
  lines.push(row.trimEnd());
 }
 const metrics=lines.map(line=>ctx.measureText(line||'가'));
 const ascent=(Math.max(...metrics.map(m=>m.actualBoundingBoxAscent||0))||size*.8);
 const descent=(Math.max(...metrics.map(m=>m.actualBoundingBoxDescent??size*.2)));
 const step=Math.max(ascent+descent+2,style.lineHeight?size*style.lineHeight:Math.max(baseStep,size+4));
 return {lines,font,size,padding,inner,spacing,ascent,descent,step,height:padding*2+Math.max(step,lines.length*step),width};
}
