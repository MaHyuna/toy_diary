import type { Flow, Screen } from './flows';
const systemIds=new Set(['deposit-pay','deposit-unknown','booking-pending','booking-repending','booking-refund','booking-refund-error','booking-refunded','booking-confirmed','inbox-refund','inbox-payment','inbox-done','inbox-expire','backup-create','backup-fail','backup-restored','channel-inbound','channel-error','requested','requested','help-done']);
const reviewFields:Record<string,string[]>={
 signup:['고객 계정과 로그인 여부','휴대폰 본인 확인·인증 만료·재전송 상태','필수 약관과 선택 동의 상태','가입·로그인·복구·탈퇴 결과와 다음 행동'],
 pets:['보호자에게 연결된 반려동물 목록과 대표 사진','아이 이름·종류·견종·체중·성별·중성화·생일','알레르기·건강·행동 특성과 보호자 공유 동의','매장 기록 연결·중복 후보·진행 중 예약 여부'],
 booking:['예약할 매장과 선택한 반려동물','고객 연락처·반려동물 견종·체중·주의사항','선택 날짜·시간·서비스 항목·총 소요 시간','요청사항·예상 총액·예약금·방문 시 잔액','현재 예약 상태와 결제·환불 상태'],
 'customer-history':['선택 반려동물과 예약·방문 일시','진행 중 예약의 확정·변경·취소 상태','예약금·최종 결제·환불 내역','공개된 사진·체중·소견·홈케어 또는 문의 내용'],
 'owner-setup':['매장명·연락처·위치와 고객 공개 정보','영업시간·휴무·차단 일정과 영향받는 예약','예약 가능한 서비스·체중 범위·조합·소요 시간','예약금·취소·환불 규정과 공개 준비 상태'],
 'owner-requests':['요청 고객과 반려동물·건강·행동 주의사항','서비스 항목·총 시간·기존 및 제안 일정','예약금 결제 확인·환불 진행 상태','변경 요청 사유·고객 답변·검토 이력·응답 기한'],
 'owner-crm':['보호자명·연락처와 연결된 반려동물','아이별 사진·체중·건강·행동·선호 스타일','방문·예약·정산·관리 기록과 내부 메모','고객 계정 연결·중복 후보·보관 상태'],
 'owner-finance':['원예약·원결제와 결제 수단·실제 거래일','최종 요금·기납부 예약금·추가금·할인·잔액','환불 누계·처리 상태·재처리 여부','운영비·장부 기간·집계 기준·관련 메모'],
 'owner-safety':['현재 로그인 주체·매장·접근 권한','세션·초안 보존과 재인증 상태','백업 지점·마지막 정상 백업·검증 결과','복원 범위·영향 내역·운영 재개 검증'],
 'owner-day':['예약 일시·반려동물·보호자 연락처','도착 여부·당일 체중·피부·털·컨디션·요청','작업 진행·추가 작업 동의·연락·중단 기록','미용 전후 기록·공개 여부·인계·정산 상태'],
 channels:['예약 채널명·공식 연동 지원 범위·권한','외부 예약 ID·마지막 동기화 시각·오류 내역','자체 예약과 외부 예약의 중복·일정 충돌','수동 조정·재시도·고객 안내 기록'],
 supplies:['샴푸 제품 사진·이름·사용 여부','구매가·용량·제조사 안내 희석비','선택 방문의 원액 사용량과 저장 원가','고객 추가 청구액·안내 근거·구매 비용과의 구분'],
 visit:['반려동물·보호자와 방문 일시','서비스·체중·예상 금액·결제 여부','건강·행동 주의·보호자 요청과 내부 메모','미용 기록·고객 공개 내용·최종 정산 결과'],
 pricing:['전체 서비스 열과 선택한 견종·체중 분류','금액 문자열·추가 요금 항목·견종·주의 안내','현재 적용 버전·변경 사유·직전 버전과의 차이','삭제·복원 영향과 연결된 새 예약 견적 사용 여부'],
 customer:['고객 계정에 연결된 반려동물','반려동물별 최근 방문·공개 기록·체중','매장 요금표·예약 가능 항목·요청 시간','공지사항과 예약 신청·확정 전 상태'],
 notice:['공지 제목·본문과 공개/비공개 상태','제목·내용 검색과 공개 상태 필터','등록·수정·공개 해제·삭제 대상','고객 홈 노출 여부와 저장 결과']
};
export function screenSpec(flow:Flow,screen:Screen){
 const role=systemIds.has(screen.id)?'시스템':screen.actor??flow.role;
 const incoming=flow.steps.flatMap(s=>s.actions.filter(a=>a.to===screen.id).map(a=>`${s.name} → ${a.label}`));
 const ui=screen.ui;
 const inputs=ui?.fields?.map(f=>`${f.label}${f.required?' [필수]':' [입력]'}${f.type==='textarea'?' · 여러 줄 작성':f.type==='date'?' · 날짜 선택':f.type==='time'?' · 시간 선택':f.type==='password'?' · 마스킹':f.type==='number'?' · 숫자 입력':''}`)??[];
 if(ui?.calendar)inputs.unshift('예약 가능 날짜 달력 · 휴무·마감과 선택 가능한 날짜 구분');
 if(ui?.services)inputs.push('목욕·위생미용·스파 복수 선택 (예시) · 항목별 요금/시간 표시','선택 항목 합계와 총 소요 시간 재계산 · 미선택 시 다음 단계 중단');
 if(ui?.requests)inputs.push('“요청사항이 있어요” 체크 시에만 요청사항 textarea 노출','체크 해제 시 확인 화면에 요청사항을 표시하지 않음');
 const display=[...(ui?.status?[`현재 상태: ${ui.status}`]:[]),...(ui?.rows?.map(r=>r.join(' · '))??[]),...(ui?.message?[ui.message]:[])];
 if(!inputs.length&&!display.length&&screen.kind==='예외')display.push('실패·제한된 작업과 사용자에게 안내할 사유','기존 요청·입력·결제 상태의 유지 여부','재시도·정정·이전 화면으로 돌아갈 동작');
 if(!inputs.length&&!display.length)display.push(...(reviewFields[flow.id]??['선택한 업무 대상과 현재 상태','관련 기록과 확인할 내용']));
 return {role,tone:role==='고객'?'customer':role==='사장님'?'owner':'system',incoming,inputs,display,checks:screen.rule.split(/(?<=[.!?])\s+/).filter(Boolean)};
}
