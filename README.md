# 사은품 차감 검수

정산 당시 **정산내역서**와 현재 **로우데이터(전체정산관리)**를 건별로 대조해서, 정산 후 사은품이 지급됐는데 정산서에서 차감되지 않은 건(이중 지출)과 정산서에 빠진 건을 찾는 웹앱이에요.

- 엑셀 파일은 **브라우저 안에서만** 읽어요. 원본 파일은 서버로 가지 않아요.
- 검수 결과(마스킹된 고객명 기준)와 실행 기록만 Supabase에 저장해요.
- 로그인은 이 앱 전용 계정(아이디/비밀번호)으로 해요. 계정은 관리자가 만들어요.

## 판정 기준

| 구분 | 조건 |
|---|---|
| ① 미차감 | 현재 로우가 `웨이브넷 지급`이고 금액이 있는데, 정산서의 `차감내역_사은품`이 그보다 적음. 차액이 환수 대상 |
| ② 정산서 누락 | 로우에는 있는데 올린 정산서 어디에도 없음. 일반·추가·환수로 나눠서 표시 |
| ③ 정산서에만 | 정산서에는 있는데 현재 로우에 없음 |
| ④ 금액 변동 | 약정·번들·동판·다른 차감 항목이 정산 후 바뀜. 과차감 포함 |
| ⑤ 확인 필요 | 로우 자체 이상. 유치자지급인데 금액 있음, 웨이브넷 지급인데 차감 부족, 동일 행 중복 |

**매칭 키**: `정산종류 + 가입서비스 + 상품명 + 상품옵션 + 개통일` + 고객명 (`*`는 아무 글자로 인정)
- 협력점명은 `★■◆○●` 같은 기호와 `(휴)`를 떼고 비교해요.
- 키가 바뀐 건은 `정산종류 + 가입서비스 + 상품명`으로 한 번 더 찾아요.
- 같은 내용의 행이 여러 줄이면 줄 수까지 1:1로 맞춰요.

## 폴더 구성

```
index.html                화면 (로그인·사이드바·본문 틀)
css/style.css             스타일 (upche-meeting 업체회의 누적분석과 같은 디자인 체계)
img/wavenet.png           WAVENET 로고
js/config.js              Supabase URL·publishable 키 (공개용 값)
js/engine.js              검수 엔진 (파일 해석·매칭·판정). 브라우저/Node 공용
js/api.js                 Supabase RPC 호출
js/app.js                 화면 그리기·동작
supabase/migrations/      DB 스키마·RLS·함수 (적용 완료된 마이그레이션)
test/engine.test.js       엔진 단위 테스트 (가상 데이터)
```

## 배포 (GitHub Pages)

1. 이 폴더를 GitHub 저장소에 올려요. Private 저장소도 괜찮아요.
2. 저장소 **Settings → Pages**로 가서 Source를 `Deploy from a branch`, Branch를 `main` / `/(root)`로 정해요.
3. 1~2분 뒤 `https://<계정>.github.io/<저장소>/`로 접속해요.

빌드 과정은 없어요. 정적 파일 그대로 올라가요.

로컬에서 확인할 때는 아래처럼 실행해요.

```bash
npm start        # http://localhost:5173
npm test         # 엔진 테스트
```

## Supabase

- 프로젝트: `woori-001's Project` (`omdyyvqkxxigilxjysbz`)
- 테이블 (모두 `gift_` 접두어라 다른 앱과 겹치지 않아요)
  - `private.gift_accounts` / `gift_sessions` / `gift_login_attempts`: 계정, 로그인 토큰(해시), 로그인 시도
  - `public.gift_runs`: 검수 실행 기록(회차, 건수, 미차감 합계, 협력점 요약, 메모, 실행자)
  - `public.gift_findings`: 검수 결과 상세

**보안 구조**
- 다섯 테이블 모두 RLS를 켜고 정책은 두지 않았어요. 그리고 `anon`·`authenticated`의 테이블 권한을 회수했어요. 그래서 브라우저 키로는 테이블을 직접 읽거나 쓸 수 없어요.
- 앱은 `gift_*` RPC 함수로만 데이터에 접근해요. 각 함수는 로그인 토큰을 먼저 확인하고, 계정 관리와 기록 숨기기는 관리자만 할 수 있어요.
- 비밀번호는 bcrypt로 저장하고, 토큰은 SHA-256 해시만 저장해요. 세션은 8시간 동안 유지되고, 사용할 때마다 연장돼요. 10분 안에 10번 틀리면 로그인을 막아요.
- 데이터를 지우지 않아요. 로그아웃은 세션 만료, 계정 중지는 `enabled=false`, 기록 삭제는 숨김(`deleted_at`)으로 처리해요.
- Supabase 보안 점검(advisor)에서 `rls_enabled_no_policy`(INFO)와 `security_definer_function_executable`(WARN)이 나오는데, 위 설계에서 의도한 결과예요. 같은 프로젝트의 upche 앱도 같은 방식이에요.

**주의**
- `js/config.js`에는 공개용 **publishable 키**만 넣어요. `service_role` 키나 secret 키는 절대 커밋하지 마세요.
- `.gitignore`가 `*.xls`, `*.xlsx`, `*.csv`를 막고 있어요. 고객 정보가 든 엑셀 파일이 커밋되지 않게 하려는 거예요.

## RPC 목록

| 함수 | 권한 | 설명 |
|---|---|---|
| `gift_login(p_id, p_password)` | 누구나 | 로그인. 토큰 발급 |
| `gift_logout(p_token)` | 누구나 | 세션 만료 |
| `gift_me(p_token)` | 로그인 | 내 정보 |
| `gift_change_password(p_token, p_old, p_new)` | 로그인 | 비밀번호 변경. 다른 세션은 끊음 |
| `gift_account_list(p_token)` | 관리자 | 계정 목록 |
| `gift_account_save(p_token, p_id, p_name, p_password, p_role, p_enabled)` | 관리자 | 계정 추가·수정·중지 |
| `gift_run_save(p_token, p_run, p_findings)` | 로그인 | 검수 결과 저장 |
| `gift_run_list(p_token, p_limit)` | 로그인 | 기록 목록 |
| `gift_run_get(p_token, p_id)` | 로그인 | 기록 상세 |
| `gift_run_memo(p_token, p_id, p_memo)` | 로그인 | 메모 수정 |
| `gift_run_hide(p_token, p_id)` | 관리자 | 기록 숨기기 |
