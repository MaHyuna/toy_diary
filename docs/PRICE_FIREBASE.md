# 요금표 기기 간 저장

현재 배포 설정은 `public/planning/firebase-config.json`의 `enabled: false`입니다.
실제 Firebase 프로젝트가 연결되기 전에는 로컬 저장만 수행하며 로그인 버튼을 활성화하지 않습니다.

## 실제 프로젝트 연결

1. 연결할 Firebase 프로젝트를 확인하고 웹 앱을 등록합니다.
2. Authentication에서 Google 로그인을 활성화하고 승인된 도메인에 `mahyuna.github.io`를 추가합니다.
3. Firestore를 생성합니다. 기본 로고는 문서에 원본을 반복 저장하지 않고 내장 로고 참조를 사용합니다.
4. 사용자 업로드 로고를 동기화하려면 Storage를 활성화합니다.
5. 웹 앱의 공개 SDK 구성에 `enabled: true`를 더해 `public/planning/firebase-config.json`에 저장합니다. 서비스 계정 키나 관리자 비밀키는 넣지 않습니다.
6. 프로젝트 관리 권한으로 `firebase/firestore.rules`, `firebase/storage.rules`를 적용합니다. **기존 프로젝트의 규칙이 있으면 해당 경로 규칙을 병합**합니다. 기존 앱의 규칙을 그대로 덮어쓰지 않습니다.
7. 테스트 계정으로 두 브라우저에서 로그인·첫 저장·다른 기기 불러오기·수정 충돌·로고 업로드를 확인한 뒤 Pages에 설정을 게시합니다.

구성 예시(실제 Firebase 콘솔에서 받은 값 사용):

```json
{
  "enabled": true,
  "apiKey": "PUBLIC_WEB_API_KEY",
  "authDomain": "PROJECT.firebaseapp.com",
  "projectId": "PROJECT",
  "storageBucket": "EXACT_BUCKET_FROM_CONSOLE",
  "appId": "EXACT_WEB_APP_ID"
}
```

이 편집기의 새 프로젝트 규칙만 적용할 경우:

```sh
npx firebase login
npx firebase deploy --only firestore:rules,storage --project ACTUAL_PROJECT_ID
```

## 저장 동작

- 문서: `users/{uid}/priceStudio/main`; 해당 사용자만 읽고 쓸 수 있습니다.
- 로고: `users/{uid}/price-logos/{sha256}`; 해당 사용자만 읽고 쓸 수 있습니다.
- 로그인 전/연결 오류 시에도 기존 로컬 저장은 유지합니다.
- 첫 연결은 현재 작업을 올릴지, 클라우드 문서를 불러올지 선택합니다.
- 변경 후 자동 저장하며 서버의 revision을 트랜잭션으로 비교합니다. 다른 기기의 변경이 먼저 저장됐으면 자동 덮어쓰기를 멈춥니다.
- 로컬 수정이 없으면 다른 기기의 변경을 수신해 적용합니다. 원격 데이터를 불러오는 중 로컬 내용이 바뀌면 교체하지 않습니다.
- 충돌 시 클라우드 문서를 선택하면 현재 로컬 문서를 백업 파일로 내려받은 뒤 불러옵니다.
- 수정 내용이 없으면 중복 쓰기를 하지 않으며 같은 로고는 현재 세션에서 반복 업로드하지 않습니다.
- 기존 로컬 편집기의 데이터는 첫 로그인에서 선택해 업로드해야 다른 기기에 보입니다.

## 검증

```sh
npm run build:price-firebase
npm run test:price-cloud
```

실제 Firebase 서비스를 사용하지 않는 `demo-price-studio` 에뮬레이터에서 권한 격리, revision 검사, 두 독립 브라우저 간 저장·불러오기, 오프라인 충돌, 백업 후 복원, 원본 로고 동기화를 검증합니다. 이것은 운영 프로젝트 연결 검증을 대신하지 않습니다.
