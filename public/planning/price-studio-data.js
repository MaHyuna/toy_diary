import {createDefaultProject} from './price-studio-defaults.js';
export {createDefaultProject};
const clone=x=>JSON.parse(JSON.stringify(x));
const fail=s=>{throw Error(s);};
const text=(v,max=1000)=>typeof v==='string'&&v.length<=max?v:fail('파일의 텍스트 형식이나 길이를 확인해 주세요.');
const id=v=>/^[a-zA-Z0-9_-]{1,80}$/.test(text(v,80))?v:fail('항목 ID가 올바르지 않아요.');
const color=v=>/^#[0-9a-f]{6}$/i.test(v)?v:fail('색상 형식이 올바르지 않아요.');
const num=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:fail('디자인 수치 범위를 확인해 주세요.');
export function validateProject(input){
 if(!input||input.version!==2)fail('지원하는 요금표 파일이 아니에요.');
 const p=createDefaultProject(),b=input.brand,d=input.design;
 if(!b||!d)fail('매장 정보나 디자인 정보가 없어요.');
 for(const k of ['name','title','contact','footer'])p.brand[k]=text(b[k],1000);
 p.brand.logo=text(b.logo,2000000);if(b.logo&&!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(b.logo))fail('백업 로고는 PNG 형식이어야 해요.');
 for(const k of Object.keys(p.design.colors))p.design.colors[k]=color(d.colors?.[k]);
 for(const [k,min,max] of [['borderWidth',.5,6],['borderInset',12,40],['headingSize',18,38],['bodySize',11,20],['priceSize',12,22],['gap',10,70],['rowHeight',24,50],['logoSize',40,120]])p.design[k]=num(d[k],min,max);
 for(const [k,values] of [['border',['none','line','double','scallop']],['font',['Jua','sans-serif']],['format',['content','portrait']]]){if(!values.includes(d[k]))fail('지원하지 않는 디자인 옵션이에요.');p.design[k]=d[k];}
 for(const k of ['corners','flowers']){if(typeof d[k]!=='boolean')fail('디자인 옵션이 올바르지 않아요.');p.design[k]=d[k];}
 if(!Array.isArray(input.columns)||input.columns.length<1||input.columns.length>8)fail('서비스 열은 1~8개여야 해요.');
 p.columns=input.columns.map(c=>({id:id(c.id),name:text(c.name,80),note:text(c.note,120)}));
 if(new Set(p.columns.map(c=>c.id)).size!==p.columns.length)fail('서비스 ID가 중복됐어요.');
 if(!Array.isArray(input.sections)||input.sections.length<1||input.sections.length>24)fail('섹션은 1~24개여야 해요.');
 p.sections=input.sections.map(s=>{
  if(!['matrix','list','text'].includes(s.kind)||!['full','half'].includes(s.span)||typeof s.visible!=='boolean')fail('섹션 형식을 확인해 주세요.');
  const out={id:id(s.id),kind:s.kind,title:text(s.title,100),breeds:text(s.breeds),note:text(s.note,3000),span:s.kind==='matrix'?'full':s.span,visible:s.visible,style:{}};
  for(const [k,v] of Object.entries(s.style||{})){if(['heading','body','price','note','line','background','tableHeader'].includes(k))out.style[k]=color(v);else if(k==='border'){if(!['none','line','dashed'].includes(v))fail('섹션 테두리 형식 오류');out.style.border=v;}else if(k==='borderWidth')out.style.borderWidth=num(v,.5,6);else fail('지원하지 않는 섹션 스타일이에요.');}
  if(s.kind==='matrix'){if(!Array.isArray(s.rows)||s.rows.length<1||s.rows.length>30)fail('몸무게 행은 1~30개여야 해요.');out.rows=s.rows.map(r=>{if(!Array.isArray(r.prices)||r.prices.length!==p.columns.length)fail('가격 칸과 서비스 열 수가 달라요.');return {id:id(r.id),weight:text(r.weight,100),prices:r.prices.map(v=>text(String(v),20))};});if(new Set(out.rows.map(r=>r.id)).size!==out.rows.length)fail('몸무게 행 ID가 중복됐어요.');}
  if(s.kind==='list'){if(!Array.isArray(s.items)||s.items.length>40)fail('목록은 40개 이하여야 해요.');out.items=s.items.map(v=>({label:text(v.label,250),value:text(v.value,250)}));}
  if(s.kind==='text')out.content=text(s.content,5000);
  return out;
 });
 if(new Set(p.sections.map(s=>s.id)).size!==p.sections.length)fail('섹션 ID가 중복됐어요.');return p;
}
export function moveColumn(p,from,to){if(!Number.isInteger(from)||!Number.isInteger(to)||Math.min(from,to)<0||Math.max(from,to)>=p.columns.length)return;const [c]=p.columns.splice(from,1);p.columns.splice(to,0,c);for(const s of p.sections)if(s.kind==='matrix')for(const r of s.rows){const [v]=r.prices.splice(from,1);r.prices.splice(to,0,v);}}
export function moveSection(p,from,to){if(Math.min(from,to)<0||Math.max(from,to)>=p.sections.length)return;const [s]=p.sections.splice(from,1);p.sections.splice(to,0,s);}
const HEAD=['record','section_id','title','breeds','note','span','visible','row_index','weight','column_index','service','service_note','price','item','value'];
const safe=s=>/^[=+\-@\t\r']/.test(String(s))?"'"+s:String(s);
const uns=s=>/^'[=+\-@\t\r']/.test(s)?s.slice(1):s;
export function toCSV(p){const rows=[HEAD];const add=o=>rows.push(HEAD.map(k=>o[k]??''));add({record:'version',value:'2'});for(const k of ['name','title','contact','footer'])add({record:'brand',item:k,value:p.brand[k]});p.columns.forEach((c,i)=>add({record:'column',column_index:i,service:c.name,service_note:c.note}));for(const s of p.sections){add({record:'section',section_id:s.id,title:s.title,breeds:s.breeds,note:s.note,span:s.span,visible:String(s.visible),item:s.kind});if(s.kind==='matrix')s.rows.forEach((r,i)=>r.prices.forEach((v,j)=>add({record:'price',section_id:s.id,row_index:i,weight:r.weight,column_index:j,price:v})));if(s.kind==='list')s.items.forEach((v,i)=>add({record:'item',section_id:s.id,row_index:i,item:v.label,value:v.value}));if(s.kind==='text')add({record:'text',section_id:s.id,value:s.content});}return '\uFEFF'+rows.map((r,i)=>r.map(v=>'"'+(i?safe(v):v).replaceAll('"','""')+'"').join(',')).join('\r\n');}
export function parseCSV(raw){if(raw.length>3000000)fail('CSV는 3MB 이하로 선택해 주세요.');raw=raw.replace(/^\uFEFF/,'');const rows=[];let row=[],value='',quoted=false,ended=false;for(let i=0;i<raw.length;i++){const c=raw[i];if(quoted){if(c==='"'){if(raw[i+1]==='"'){value+='"';i++;}else{quoted=false;ended=true;}}else value+=c;}else if(c==='"'){if(value||ended)fail('CSV 따옴표 형식이 올바르지 않아요.');quoted=true;}else if(c===','){row.push(value);value='';ended=false;}else if(c==='\n'||c==='\r'){if(c==='\r'&&raw[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';ended=false;}else{if(ended)fail('CSV 따옴표 뒤 문자를 확인해 주세요.');value+=c;}}if(quoted)fail('CSV 따옴표가 닫히지 않았어요.');if(value||row.length||ended){row.push(value);rows.push(row);}if(rows.length>10000)fail('CSV 행이 너무 많아요.');return rows;}
export function fromCSV(raw){const data=parseCSV(raw);if(JSON.stringify(data.shift())!==JSON.stringify(HEAD))fail('이 편집기에서 내보낸 CSV 형식으로 불러와 주세요.');const p=createDefaultProject();p.columns=[];p.sections=[];const map=new Map(),prices=new Map(),items=new Map(),seen=new Set();let version=false;
 for(const a of data){if(a.length!==HEAD.length)fail('CSV 열 개수가 달라요.');const r=Object.fromEntries(HEAD.map((k,i)=>[k,uns(a[i])]));if(r.record==='version'){if(version||r.value!=='2')fail('CSV 버전이 올바르지 않아요.');version=true;}else if(r.record==='brand'){if(!['name','title','contact','footer'].includes(r.item)||seen.has('brand:'+r.item))fail('매장 정보가 중복되거나 올바르지 않아요.');seen.add('brand:'+r.item);p.brand[r.item]=r.value;}else if(r.record==='column'){const i=Number(r.column_index);if(!/^\d+$/.test(r.column_index)||i>7||p.columns[i])fail('서비스 순서가 중복되거나 올바르지 않아요.');p.columns[i]={id:'csv-col-'+i,name:r.service,note:r.service_note};}else if(r.record==='section'){if(map.has(r.section_id))fail('섹션 ID 중복');if(!['true','false'].includes(r.visible))fail('표시 여부 오류');const s={id:r.section_id,kind:r.item,title:r.title,breeds:r.breeds,note:r.note,span:r.span,visible:r.visible==='true',style:{}};if(s.kind==='matrix')s.rows=[];if(s.kind==='list')s.items=[];if(s.kind==='text')s.content='';p.sections.push(s);map.set(s.id,s);}else if(['price','item','text'].includes(r.record)){const s=map.get(r.section_id);if(!s)fail('섹션보다 먼저 나온 데이터가 있어요.');if(r.record==='price'){if(s.kind!=='matrix'||!/^\d+$/.test(r.row_index)||!/^\d+$/.test(r.column_index)||Number(r.row_index)>29||Number(r.column_index)>7)fail('가격 칸 위치 오류');const key=`${s.id}:${r.row_index}:${r.column_index}`;if(prices.has(key))fail('가격 칸이 중복됐어요.');prices.set(key,r.price);const i=Number(r.row_index);if(!s.rows[i])s.rows[i]={id:'csv-row-'+i,weight:r.weight,prices:[]};if(s.rows[i].weight!==r.weight)fail('같은 행의 몸무게 이름이 달라요.');s.rows[i].prices[Number(r.column_index)]=r.price;}else if(r.record==='item'){const i=Number(r.row_index);if(s.kind!=='list'||!/^\d+$/.test(r.row_index)||i>39||s.items[i])fail('목록 위치가 중복되거나 올바르지 않아요.');s.items[i]={label:r.item,value:r.value};}else{if(s.kind!=='text'||items.has(s.id))fail('설명 섹션 오류');items.set(s.id,true);s.content=r.value;}}else fail('알 수 없는 CSV 행 유형이에요.');}
 if(!version)fail('CSV 버전 정보가 없어요.');for(let i=0;i<p.columns.length;i++)if(!p.columns[i])fail('서비스 순서가 누락됐어요.');for(const s of p.sections){if(s.kind==='matrix'){for(let i=0;i<s.rows.length;i++){if(!s.rows[i])fail('몸무게 행 누락');for(let j=0;j<p.columns.length;j++)if(!prices.has(`${s.id}:${i}:${j}`))fail('가격 칸이 누락됐어요.');}}if(s.kind==='list')for(let i=0;i<s.items.length;i++)if(!s.items[i])fail('목록 행 누락');}return validateProject(p);
}
