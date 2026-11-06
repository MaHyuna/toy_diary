# 몽글 UI 기준: Adobe Spectrum 2

2026-11-06 사용자 결정: 공식 Spectrum 2 컴포넌트를 기본으로 사용하고, 제공되지 않거나 업무에 부족한 부분만 별도 CSS로 보완한다.

## 사용 규칙

- 패키지: `@react-spectrum/s2` 1.8.2. React 19 사용. S1 패키지와 혼용하지 않는다.
- 새 UI는 먼저 Spectrum 2 컴포넌트 지원 여부를 확인한다. 현재 Button/LinkButton, TextField/TextArea, NumberField, Picker/PickerItem, DatePicker, Checkbox, TableView, Heading/Text/Divider를 사용한다.
- `src/ui/SpectrumSurface.tsx`에서 한국어 `ko-KR`, 밝은 테마를 제공한다. 현재 이 Provider는 전환된 업무 화면에 적용된다. 앱 전체 전환 완료를 의미하지 않는다.
- 컴포넌트의 색·테두리·포커스·disabled·hover·입력 동작은 공식 props와 토큰을 따른다. 라이브러리 생성 클래스명이나 내부 DOM을 대상으로 CSS를 덮어쓰지 않는다.
- `src/ui/workflow.css`는 화면 너비, grid/flex, 섹션 배치, 모바일 재배치 등 앱 레이아웃만 담당한다. 이후 캘린더·인쇄용 안내표 등 별도 업무 UI도 별도 파일로 분리한다.
- 공식 스타일 매크로는 현재 사용하지 않는다. 이미 컴파일된 패키지 CSS를 Vite로 묶는다. `UNSAFE_style`은 현재 표 컨테이너 높이·너비와 입력 너비에만 사용한다.
- `index.html`의 `@layer mongle-legacy, _`와 Vite의 `legacy-css-layer`로 기존 src CSS를 낮은 우선순위에 둔다. `/src/ui/`의 신규 레이아웃 CSS는 별도다. 기존 선택자나 `!important`를 추가해서 라이브러리를 다시 꾸미지 않는다.
- 신규 화면은 모바일 320/390px와 PC 768/1440px에서 확인한다. 폼의 한국어 레이블, 키보드 이동, 오류·로딩·빈 상태를 함께 점검한다.

## 이번 적용 범위

- 고객 예약: 서비스·몸무게 선택, 날짜·시간, 고객 정보, 확인·수정·접수.
- 사장님 요금 관리: Spectrum 입력표와 예약 요금 연결 설정.
- 사장님 예약 폼: 게시 요금표의 금액을 명시적으로 불러오는 부분.

달력, 고객관리, 장부, 기존 로그인 화면, 사장님 예약 폼의 나머지 부분은 기존 UI다. 고객에게 게시하는 미용 요금 안내표는 같은 원본 데이터를 읽으며 기존 인쇄용 디자인을 유지한다. 사장님 편집 컨트롤의 변경과 고객 안내 콘텐츠의 변경을 구분한다.

## 공식 참고

- https://react-spectrum.adobe.com/
- https://www.npmjs.com/package/@react-spectrum/s2
- 설치 패키지의 공식 타입과 컴포넌트 구현을 기준으로 연동. 구형 `/s2/getting-started.html` 링크는 현재 홈페이지로 이동하므로 과거 S1 설치법을 사용하지 않음.
