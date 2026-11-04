import type { Appointment } from './types.ts';
const escapeText=(value:string)=>value.replaceAll('\\','\\\\').replace(/\r\n|\r|\n/g,'\\n').replaceAll(',','\\,').replaceAll(';','\\;');
const stamp=(date:Date)=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const fold=(line:string)=>{const parts:string[]=[];let part='',length=0;for(const char of line){const size=new TextEncoder().encode(char).length;if(length+size>75){parts.push(part);part=' ';length=1;}part+=char;length+=size;}parts.push(part);return parts.join('\r\n');};
export function calendarIcs(appointments:Appointment[],createdAt=new Date()):string{
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Mongle//Grooming Calendar//KO','CALSCALE:GREGORIAN',...appointments.filter(a=>a.status!=='cancelled').flatMap(a=>{const start=new Date(`${a.date}T${a.time}:00+09:00`);return ['BEGIN:VEVENT',`UID:${a.id}@mongle.local`,`DTSTAMP:${stamp(createdAt)}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(new Date(start.getTime()+a.duration*60000))}`,`SUMMARY:${escapeText(a.dogName+' · '+a.service)}`,`DESCRIPTION:${escapeText('예약 예상 '+a.price+'원 · '+(a.paymentStatus==='paid'?'결제 완료':'미결제'))}`,'END:VEVENT'];}),'END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
