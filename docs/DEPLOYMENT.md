# 몽글 체험판 공유하기

공유용 체험판은 **GitHub Pages**로 게시합니다. 저장소는 `MaHyuna/toy_diary`이며, 게시 후 주소는 `https://mahyuna.github.io/toy_diary/`입니다. 파일을 브랜치에 올리는 작업과 GitHub가 사이트 게시를 완료하는 작업은 별개입니다. 아래 설정과 접속 확인까지 마쳐야 공유할 수 있습니다.

## 두 가지 실행 방식

| 구분 | 공유용 체험판 | 매장용 로컬 서버 |
| --- | --- | --- |
| 용도 | 가상 데이터로 기능 체험 | 한 기기에서 매장 기록 관리 |
| 화면 빌드 | `npm run build:demo` | `npm run build` |
| 빌드 결과 | `demo-dist` | `dist` |
| 데이터 저장 | 방문자 브라우저의 사이트 저장소 | 서버의 `data/grooming.sqlite` |
| Python 서버 | 필요 없음 | 필요 |
| 다른 사람과 데이터 공유 | 공유하지 않음 | 현재 여러 사용자 운영 미지원 |

같은 체험판 URL을 공유해도 **각자 별도의 장부**를 사용합니다. 다른 사람의 브라우저에 내 입력 내용이 보이지 않으며, PC에서 기록한 내용이 휴대폰으로 이어지지도 않습니다. 화면 위의 **체험 데이터 초기화**는 현재 브라우저의 테스트 기록을 지우고 예시 데이터로 되돌립니다. 사이트 데이터를 삭제하거나 다른 브라우저로 열면 기존 테스트 기록을 사용할 수 없습니다. 실제 고객 이름·연락처 대신 가상 정보로 시험하세요.

## 공유 파일 만들기

파일을 만들 때는 Node.js 22.12 이상과 npm, ZIP 생성용 Python 3.10 이상이 필요합니다. 게시된 체험판 실행에는 Python 서버가 필요하지 않습니다. 저장소 루트에서 실행합니다.

```bash
npm ci
npm run test:demo
npm run test:calendar
npm run package:demo
```

`package:demo`가 `build:demo`를 실행한 뒤 ZIP 파일을 만듭니다. ZIP 없이 웹 파일만 만들려면 `npm run build:demo`를 사용합니다.

업로드할 파일은 `artifacts/mongle-demo.zip`입니다. 압축을 풀면 웹사이트 시작 파일인 `index.html`과 `assets` 폴더가 있어야 합니다. 서버 데이터베이스는 체험판에 포함하지 않습니다.

## GitHub Pages 최초 설정

원본 코드는 `main`, `demo-dist`의 내용만 담은 게시 파일은 `gh-pages` 브랜치에 저장합니다. `.nojekyll` 파일로 Jekyll 처리 없이 정적 파일을 게시하며, 상대 경로로 빌드하므로 `/toy_diary/` 아래에서도 화면과 아이콘을 불러올 수 있습니다.

1. 저장소 관리자 계정으로 [Settings → Pages](https://github.com/MaHyuna/toy_diary/settings/pages)를 엽니다.
2. **Build and deployment → Source**에서 **Deploy from a branch**를 선택합니다.
3. **Branch**는 **gh-pages**, 폴더는 **/(root)**로 지정하고 **Save**를 누릅니다.
4. 저장소의 **Actions**에서 Pages 배포가 성공했는지 확인합니다. 최초 게시에는 몇 분이 걸릴 수 있습니다.
5. `https://mahyuna.github.io/toy_diary/`를 열어 **체험판 안내**가 보이는지 확인합니다.
6. 예약 등록·정산·지출 기록을 시험한 뒤 주소를 공유합니다. 다른 브라우저에서는 별도의 예시 데이터로 시작해야 합니다.

`gh-pages` 브랜치가 목록에 없다면 아직 게시 파일 업로드가 끝나지 않은 상태입니다. 브랜치 생성만으로 최초 Pages 활성화가 보장되지는 않습니다. 이 환경에서 GitHub 설정 API 접근이 제한되면 저장소 소유자가 위 설정을 한 번 저장해야 합니다. 비밀번호나 토큰을 대화에 입력할 필요는 없습니다.

## 화면을 수정한 뒤 다시 게시하기

`npm run test:demo`, `npm run test:calendar`, `npm run build:demo`를 실행하고 새 `demo-dist` 내용을 `gh-pages` 브랜치에 커밋·업로드합니다. Pages가 해당 브랜치를 다시 배포합니다. 실제 고객 기록이 있는 `data` 디렉터리나 서버 파일을 게시 브랜치에 포함하지 않습니다. 원본 코드 수정은 `main`에도 별도로 저장합니다.

현재 `main` 변경을 자동으로 빌드하는 워크플로는 없습니다. GitHub 기본 Pages 배포가 이미 빌드된 `gh-pages` 파일을 게시하는 방식입니다. 별도 정적 호스팅을 쓰려면 `artifacts/mongle-demo.zip`을 풀어 `index.html`이 바로 들어 있는 폴더를 업로드할 수도 있습니다.

## 확인할 점

- 체험판에서 변경한 데이터는 로컬 서버판의 SQLite에 반영되지 않습니다.
- 체험판을 같은 주소에 다시 게시해도 다른 사용자의 기록을 공동 장부로 합치지 않습니다.
- 여러 직원·기기에서 실제 매장 데이터를 공유하려면 인증, 권한, 공용 서버와 백업을 갖춘 별도 운영 배포가 필요합니다.
- Codex의 **환경 게시(Publish)**는 개발 환경을 보존하는 기능이며 웹사이트에 공개 주소를 만드는 배포가 아닙니다.
