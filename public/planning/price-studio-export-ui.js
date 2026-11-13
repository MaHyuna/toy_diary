import {PAPERS,validatePrint,printPreview,exportPrint} from './price-studio-print.js?v=decor-22';
export function createExportUI({getProject,getLogo,change,download,filename,ready}){
 const $=id=>document.getElementById(id);let busy=false;
 const controls=['paper','orientation','width','height','layout','format','dpi','bleed','cropMarks'];
 for(const [name,[width,height]] of Object.entries(PAPERS))$('print-paper').add(new Option(`${name} · ${width} × ${height} mm`,name));
 $('print-paper').add(new Option('사용자 지정','custom'));
 function refresh(){
  if(busy)return;const project=getProject(),s=validatePrint(project.print);
  for(const key of controls){const el=$('print-'+key);if(el!==document.activeElement){if(el.type==='checkbox')el.checked=s[key];else el.value=s[key];}}
  $('print-custom').hidden=s.paper!=='custom';$('print-density').hidden=!['png','jpg'].includes(s.format);
  $('export-current').textContent=`${s.format.toUpperCase()} 저장`;$('export-current').disabled=!ready();
  if(!$('export-menu').open)return;
  try{
   const canvas=document.createElement('canvas'),g=printPreview(canvas,project,getLogo(),s);
   $('export-preview').src=canvas.toDataURL();
   const mm=n=>Number(n.toFixed(1));
   $('export-summary').textContent=`${s.layout==='sheet'?(s.paper==='custom'?'사용자 지정':s.paper):'높이 자동'} · ${mm(g.width)} × ${mm(g.height)} mm`;
   const raster=['png','jpg'].includes(s.format);
   $('export-description').textContent=`${s.layout==='sheet'?'내용을 한 장 안에 맞춥니다.':'현재 배치의 비율을 유지합니다.'} ${raster?`${g.pixelWidth.toLocaleString()} × ${g.pixelHeight.toLocaleString()} px · ${s.dpi} dpi`:'글자·표·장식은 확대해도 선명한 벡터로 저장됩니다.'}${s.bleed||s.cropMarks?` 저장 파일 ${mm(g.outerWidth)} × ${mm(g.outerHeight)} mm (도련·재단선 포함).`:''}`;
   $('print-outline-note').textContent=s.format==='svg'?'글자를 모두 윤곽선(패스)으로 변환합니다. 피그마에서 가져올 수 있으며, 문구 수정은 이 편집기에서 해주세요.':s.format==='pdf'?'글자를 모두 윤곽선으로 변환한 벡터 PDF입니다. 인쇄할 때 실제 크기(100%)를 선택해 주세요.':'선택한 용지 크기와 dpi에 맞춰 새로 렌더링합니다. JPG는 고품질로 저장합니다.';
   const error=g.result.error||(raster&&(g.pixelWidth*g.pixelHeight>32000000||Math.max(g.pixelWidth,g.pixelHeight)>16000)?'이 크기는 PDF·SVG 저장을 권장합니다. 이미지로 저장하려면 dpi를 낮춰 주세요.':'');
   $('export-error').textContent=error;$('export-current').disabled=!!error||!ready();
  }catch(e){$('export-error').textContent=e.message;$('export-current').disabled=true;}
 }
 for(const key of controls)$('print-'+key).addEventListener('change',()=>{
  try{const s=validatePrint(getProject().print),el=$('print-'+key);s[key]=el.type==='checkbox'?el.checked:el.type==='number'||['dpi','bleed'].includes(key)?Number(el.value):el.value;getProject().print=validatePrint(s);change();}catch(e){$('export-error').textContent=e.message;$('export-current').disabled=true;}
 });
 $('export-current').onclick=async()=>{
  if(busy||!ready())return;busy=true;$('export-current').disabled=true;$('export-current').textContent='글자 윤곽선 · 파일 만드는 중…';$('export-error').textContent='';
  $('print-fields').disabled=true;$('export-close').disabled=true;
  try{
   const project=structuredClone(getProject()),settings=validatePrint(project.print),name=filename();
   const {blob}=await exportPrint(project,getLogo(),settings);
   download(blob,`${name}_요금표_${settings.layout==='sheet'?settings.paper:'자동높이'}.${settings.format}`,blob.type);
   $('print-status').textContent=`${settings.format.toUpperCase()} 파일을 저장했어요.`;
  }catch(e){$('print-status').textContent='';$('export-error').textContent=e.message||'저장하지 못했어요. 다시 시도해 주세요.';}
  finally{busy=false;$('print-fields').disabled=false;$('export-close').disabled=false;$('export-current').disabled=!ready();$('export-current').textContent=`${validatePrint(getProject().print).format.toUpperCase()} 저장`;}
 };
 $('export-menu').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 return {refresh};
}
