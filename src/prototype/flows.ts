import { scenarios } from './scenarios.ts';
import type { ScenarioUI } from './scenarios.ts';
export type Screen={id:string;name:string;kind:string;purpose:string;rule:string;actions:{label:string;to:string;primary?:boolean}[];future?:boolean;actor?:'고객'|'사장님';ui?:ScenarioUI};
export type Flow={id:string;name:string;role:'사장님'|'고객';summary:string;path:string;steps:Screen[]};
const action=(label:string,to:string,primary=false)=>({label,to,primary});
export const flows:Flow[]=[
 ...scenarios,
 {id:'visit',name:'예약부터 미용 완료까지',role:'사장님',summary:'오늘의 예약을 확인하고, 아이의 관리 기록과 결제를 함께 마무리합니다.',path:'/owner/',steps:[
  {id:'calendar',name:'예약 캘린더',kind:'첫 화면',purpose:'날짜마다 예약 건수와 금액을 한눈에 확인합니다.',rule:'날짜를 선택하면 당일 일정이 열립니다. 새 예약은 + 버튼에서만 시작합니다.',actions:[action('11월 6일 일정 보기','day',true),action('+ 예약 등록','new-visit')]},
  {id:'day',name:'하루 일정',kind:'목록',purpose:'시간순 예약과 미용·결제 상태를 확인합니다.',rule:'목록의 예약을 선택해 상세로 이동합니다. 닫기는 패널 닫기이며 예약 취소와 구분합니다.',actions:[action('09:00 몽이 예약 보기','visit-detail',true),action('+ 예약 등록','new-visit'),action('달력으로','calendar')]},
  {id:'new-visit',name:'예약 등록',kind:'등록',purpose:'보호자·반려견을 검색하고 방문 시간과 요금을 정합니다.',rule:'검색 결과는 보호자명 | 반려동물명 | 전화번호 뒤 4자리입니다. 확정된 입력만 예약 목록에 추가합니다.',actions:[action('예약 등록','day',true),action('작성 취소','day')]},
  {id:'visit-detail',name:'방문 상세',kind:'조회',purpose:'반려견·보호자 정보, 주의사항과 이번 방문의 내용을 확인합니다.',rule:'미용 기록과 금액을 구분합니다. 예약 취소는 별도의 확인 단계를 거칩니다.',actions:[action('미용 기록 작성','care-edit',true),action('미용 완료 · 결제','checkout'),action('예약 취소','cancel-visit'),action('일정 목록','day')]},
  {id:'care-edit',name:'미용 전·후 기록',kind:'수정',purpose:'전후 사진, 미용 소견, 보호자가 챙길 내용을 작성합니다.',rule:'기록 저장과 고객 공개는 별개입니다. 공개할 내용만 연결된 보호자의 미용수첩에 전달합니다.',actions:[action('기록 저장','visit-detail',true),action('고객 공개 확인','care-publish'),action('작성 취소','visit-detail')]},
  {id:'care-publish',name:'고객 공개 확인',kind:'공개',purpose:'고객에게 보일 관리 기록을 확인하고 공개합니다.',rule:'내부 메모와 결제 내역은 고객 공개 대상이 아닙니다. 연결된 보호자만 자신의 반려견 기록을 볼 수 있습니다.',actions:[action('고객에게 공개','visit-detail',true),action('수정으로 돌아가기','care-edit')]},
  {id:'checkout',name:'미용 완료 · 결제',kind:'처리',purpose:'최종 금액과 결제 수단, 실제 결제일을 확인합니다.',rule:'결제 기록은 한 번만 반영합니다. 미용 소견 저장과 결제 처리는 독립된 작업입니다.',actions:[action('완료 · 결제 기록','paid',true),action('돌아가기','visit-detail')]},
  {id:'paid',name:'완료된 방문',kind:'결과',purpose:'기록한 결제와 미용 내용을 다시 확인합니다.',rule:'완료 금액은 장부에 반영됩니다. 이후 요금표를 변경해도 이 방문의 결제 금액은 유지됩니다.',actions:[action('일정 목록으로','day',true),action('미용 기록 보기','care-publish')]},
  {id:'cancel-visit',name:'예약 취소 확인',kind:'확인',purpose:'취소할 예약을 확인합니다.',rule:'취소를 눌렀다고 즉시 삭제하지 않습니다. 취소 이력과 결제 기록은 구분합니다.',actions:[action('예약 유지','visit-detail',true),action('예약 취소 확정','day')]}
 ]},
 {id:'pricing',name:'요금표 관리와 버전 복원',role:'사장님',summary:'목록에서 시작해 조회·수정하고, 변경 이력을 비교한 뒤 안전하게 복원합니다.',path:'/owner/?view=pricing',steps:[
  {id:'price-list',name:'요금 분류 목록',kind:'목록',purpose:'등록된 분류를 검색하고 선택합니다.',rule:'메뉴를 열면 목록부터 표시합니다. 등록 버튼을 눌러야 작성이 시작됩니다.',actions:[action('소형견 미용 보기','price-detail',true),action('+ 섹션 등록','price-create'),action('변경 이력','history')]},
  {id:'price-detail',name:'요금 분류 상세',kind:'조회',purpose:'고객에게 적용 중인 서비스·체중별 표를 읽습니다.',rule:'조회 중에는 금액 입력창이 없습니다. 수정과 삭제는 명시적인 버튼으로 구분합니다.',actions:[action('분류 수정','price-edit',true),action('분류 삭제','price-delete'),action('목록으로','price-list')]},
  {id:'price-create',name:'새 섹션 등록',kind:'등록',purpose:'새 견종 분류나 고양이·추가 요금 항목을 만듭니다.',rule:'작성 취소는 현재 요금표를 바꾸지 않습니다. 등록 후 저장하면 새 버전이 만들어집니다.',actions:[action('섹션 저장','price-list',true),action('작성 취소','price-list')]},
  {id:'price-edit',name:'요금표 수정',kind:'수정',purpose:'금액과 설명을 수정하고 변경 사유를 남깁니다.',rule:'저장 성공 시 목록으로 돌아갑니다. 다른 기기에서 먼저 수정했으면 초안을 유지하고 덮어쓰기를 막습니다.',actions:[action('요금표 저장','price-list',true),action('목록으로 돌아가기','discard'),action('동시 수정 충돌 보기','conflict')]},
  {id:'discard',name:'변경사항 폐기 확인',kind:'확인',purpose:'미저장 내용을 버릴지 결정합니다.',rule:'확인 전에는 입력 내용이 유지됩니다.',actions:[action('계속 수정','price-edit',true),action('변경 버리고 목록으로','price-list')]},
  {id:'conflict',name:'저장 충돌',kind:'예외',purpose:'다른 화면에서 먼저 저장한 변경을 덮어쓰지 않습니다.',rule:'입력은 남겨두고 저장만 중단합니다. 최신 내용을 다시 확인한 뒤 수정해야 합니다.',actions:[action('초안으로 돌아가기','price-edit',true),action('최신 목록 확인','discard')]},
  {id:'history',name:'요금표 변경 이력',kind:'목록',purpose:'버전·기록 시각·변경 사유를 확인합니다.',rule:'기존 저장본부터 보존합니다. 이미 덮어쓴 과거 데이터는 재구성하지 않습니다.',actions:[action('v1 내용 보기','version',true),action('요금 목록으로','price-list')]},
  {id:'version',name:'버전 상세 · 비교',kind:'조회',purpose:'그때의 전체 요금표와 변경 전후 값을 확인합니다.',rule:'과거 버전은 읽기 전용입니다. 현재 내용을 바꾸려면 복원 확인을 거칩니다.',actions:[action('이 버전으로 복원','restore',true),action('이력 목록','history')]},
  {id:'restore',name:'복원 영향 확인',kind:'확인',purpose:'현재 표에서 무엇이 달라지는지 확인합니다.',rule:'복원도 새 버전입니다. 기존 예약·결제 금액은 유지합니다. 이미지 장식과 예약 시간 설정은 복원 대상이 아닙니다.',actions:[action('복원 확정','restored',true),action('복원 취소','version')]},
  {id:'restored',name:'복원 완료',kind:'결과',purpose:'현재 적용 버전과 남아 있는 이력을 확인합니다.',rule:'v1 내용을 복원하면 v3가 추가됩니다. v1과 v2는 삭제되지 않습니다.',actions:[action('변경 이력 보기','history',true),action('요금 목록으로','price-list')]},
  {id:'price-delete',name:'분류 삭제 확인',kind:'확인',purpose:'삭제 대상과 고객 화면에 미칠 영향을 확인합니다.',rule:'삭제도 이력에 남습니다. 해당 분류의 새 예약 견적은 사용할 수 없지만 기존 예약 기록은 유지됩니다.',actions:[action('유지하기','price-detail',true),action('분류 삭제 확정','price-list')]}
 ]},
 {id:'customer',name:'고객의 예약과 미용수첩',role:'고객',summary:'요금을 확인하고 예약을 신청한 뒤, 우리 아이의 공개된 관리 기록을 봅니다.',path:'/customer/',steps:[
  {id:'home',name:'고객 홈 · 미용수첩',kind:'첫 화면',purpose:'연결된 반려견, 공개된 미용 기록과 매장 공지를 확인합니다.',rule:'사장님 메뉴와 주소·권한이 분리됩니다. 내 반려견의 공개 기록만 보여줍니다.',actions:[action('몽이 미용수첩','notebook',true),action('요금표 보기','public-prices'),action('예약 신청','request')]},
  {id:'public-prices',name:'고객 요금표',kind:'조회',purpose:'견종·체중·서비스별 요금을 세로로 이어 봅니다.',rule:'사장님이 저장한 같은 원본을 읽습니다. 분류 탭과 편집 버튼은 없습니다.',actions:[action('예약 신청하기','request',true),action('고객 홈','home')]},
  {id:'request',name:'예약 신청',kind:'등록',purpose:'아이 정보, 서비스와 방문 시간을 입력합니다.',rule:'예약 가능한 요금 항목을 연결한 매장을 가정한 예시입니다. 설정이 없으면 실제 앱은 준비 중으로 표시합니다.',actions:[action('신청 내용 확인','request-review',true),action('작성 취소','home')]},
  {id:'request-review',name:'예약 신청 확인',kind:'확인',purpose:'신청 시간과 예상 금액, 연락처를 다시 확인합니다.',rule:'신청은 즉시 확정이나 결제가 아닙니다. 사장님이 수락한 뒤 예약에 반영합니다.',actions:[action('예약 신청 보내기','requested',true),action('내용 수정','request')]},
  {id:'requested',name:'신청 접수',kind:'결과',purpose:'접수 결과와 확정 전 상태를 안내합니다.',rule:'현재는 신청 접수와 사장님 승인 처리가 구현되어 있습니다. 자동 메시지 발송은 별도 연동이 필요합니다.',actions:[action('고객 홈','home',true),action('확정 알림 구상 보기','notification')]},
  {id:'notebook',name:'몽이의 미용수첩',kind:'조회',purpose:'방문별 체중, 미용 전후 사진과 관리 조언을 봅니다.',rule:'사장님이 공개한 기록만 표시합니다. 내부 메모와 장부는 노출하지 않습니다.',actions:[action('다음 미용 예약','request',true),action('고객 홈','home')]},
  {id:'notification',name:'예약 확정 알림',kind:'후속 설계',purpose:'예약이 확정되면 보호자가 바로 알 수 있게 합니다.',rule:'알림 채널 선택·동의·발송 및 재시도는 아직 구현 범위가 아닙니다. 이 화면은 검토용 제안입니다.',future:true,actions:[action('접수 화면으로','requested',true)]}
 ]},
 {id:'notice',name:'공지 작성과 고객 공개',role:'사장님',summary:'공지 목록에서 작성·상세·수정·삭제를 구분하고 고객 공개를 선택합니다.',path:'/owner/?view=notices',steps:[
  {id:'notice-list',name:'공지 목록',kind:'목록',purpose:'공개·비공개 공지를 검색하고 관리합니다.',rule:'메뉴를 눌러도 작성 폼이 바로 열리지 않습니다.',actions:[action('11월 휴무 안내 보기','notice-detail',true),action('+ 공지 쓰기','notice-new')]},
  {id:'notice-detail',name:'공지 상세',kind:'조회',purpose:'공지 본문과 공개 상태를 확인합니다.',rule:'고객에게 공개된 공지는 고객 홈에서도 보입니다.',actions:[action('공지 수정','notice-edit',true),action('공지 삭제','notice-delete'),action('공지 목록','notice-list')]},
  {id:'notice-new',name:'새 공지 쓰기',kind:'등록',purpose:'제목·본문을 작성하고 공개 여부를 선택합니다.',rule:'저장하기 전에는 고객 화면에 반영하지 않습니다.',actions:[action('공지 저장','notice-list',true),action('작성 취소','notice-list')]},
  {id:'notice-edit',name:'공지 수정',kind:'수정',purpose:'본문이나 공개 상태를 변경합니다.',rule:'저장 후에만 고객 화면이 변경됩니다.',actions:[action('수정 저장','notice-detail',true),action('작성 취소','notice-detail')]},
  {id:'notice-delete',name:'공지 삭제 확인',kind:'확인',purpose:'삭제할 제목과 공개 상태를 확인합니다.',rule:'삭제 확정 후 고객 화면에서도 사라집니다.',actions:[action('공지 유지','notice-detail',true),action('삭제 확인','notice-list')]}
 ]}
];
