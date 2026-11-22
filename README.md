# 검사 동선 지도 · Netlify 배포 안내 (GitHub 없이 CLI로)

키(JSONBin, 카카오)는 **Netlify 환경 변수**에만 두고, 페이지는 **서버 함수(/api)** 를 거쳐서만 사용합니다.
페이지에는 키가 없고, 처음 접속할 때 **팀 공용 접속 암호**를 한 번 입력합니다.

## 폴더 구조

```
inspection-map/
├─ netlify.toml                  배포 설정 (공개 폴더 = public, 함수 폴더 지정)
├─ netlify/functions/api.mjs     서버 함수 (키 보관, 암호 확인)
└─ public/                       ← 이 안의 파일만 인터넷에 공개됩니다
   ├─ index.html
   ├─ manifest.webmanifest
   ├─ sw.js
   └─ icons/ (아이콘 4개)
```

이 폴더 밖에 있는 예전 `index.html`(키를 직접 넣는 버전)은 더 이상 쓰지 마세요.

## 0. 준비물

- 컴퓨터에 **Node.js(LTS)** 설치
- Netlify 계정 (이미 쓰던 사이트가 있으면 그 사이트에 덮어써도 됩니다)
- 새로 발급한 키 2종 + 정해 둔 접속 암호

## 1. 키와 암호 준비

| 환경 변수 이름 | 넣을 값 |
|---|---|
| `JSONBIN_BIN_ID` | JSONBin 데이터(bin)의 ID |
| `JSONBIN_MASTER_KEY` | JSONBin 마스터 키 (**새로 발급 권장**) |
| `KAKAO_REST_API_KEY` | 카카오 개발자 콘솔의 **REST API 키** (JavaScript 키 아님) |
| `APP_PASSCODE` | 팀 공용 접속 암호 (**10자 이상 권장**, 한글 가능) |

- 예전 `index.html`에 실제 키를 넣어 배포한 적이 있다면, 그 키는 노출된 것으로 보고 **JSONBin과 카카오에서 새 키로 교체**하세요.
- 카카오 개발자 콘솔 → 내 애플리케이션 → 제품 설정 → **카카오맵(로컬) 사용 설정 ON**이 필요합니다. 꺼져 있으면 주소 검색이 권한 오류로 막힙니다.

## 2. Netlify CLI 설치·로그인·사이트 연결

```
npm install -g netlify-cli
netlify login
cd inspection-map
netlify link
```

`netlify link`에서 기존 Netlify 사이트를 선택합니다. (새로 만들려면 `netlify sites:create`)

## 3. 환경 변수 등록 (배포 전에!)

Netlify 사이트 설정의 **Environment variables** 화면에서 위 4개를 추가하거나, CLI로 등록합니다.

```
netlify env:set JSONBIN_BIN_ID "값"
netlify env:set JSONBIN_MASTER_KEY "값"
netlify env:set KAKAO_REST_API_KEY "값"
netlify env:set APP_PASSCODE "값"
```

- 암호에 특수문자가 있으면 CLI 대신 화면에서 입력하는 편이 안전합니다.
- 변수 범위(scope)를 고르는 화면이 보이면 **Functions**를 포함하세요. (무료 플랜은 범위 선택이 없을 수 있습니다.)
- `netlify.toml`에 적은 변수는 함수에서 읽을 수 없으니 거기에는 적지 마세요.
- 값은 **배포할 때 고정**됩니다. 나중에 바꾸면 다시 배포해야 반영됩니다.

## 4. 배포

```
netlify deploy --prod --dir=public --functions=netlify/functions
```

- 배포 1회마다 Netlify 크레딧이 소모됩니다. 크레딧이 소진된 상태에서는 다음 결제 주기 전까지 배포가 되지 않습니다.
- 먼저 `--prod` 없이 `netlify deploy ...`만 실행하면 임시 주소로 미리 확인할 수 있습니다.

## 5. 확인 체크리스트

1. 사이트 주소로 접속 → **접속 암호 화면**이 뜬다
2. 틀린 암호 → "암호가 올바르지 않습니다."
3. 맞는 암호 → 일정 목록이 불러와진다 (이후 이 기기에서는 암호를 다시 묻지 않음)
4. ＋로 일정 추가(주소 입력) → 지도에 위치가 찍힌다 (주소 검색 확인)
5. 같은 날 같은 조 일정이 2개 이상이면 카드에 🚗 이동시간이 보인다 (이동시간 확인)

파일을 더블클릭해서 열면 `/api`가 없어 동작하지 않습니다. 반드시 배포된 주소로 접속하세요.

## 암호·키를 바꾸고 싶을 때

환경 변수 값을 수정 → **다시 배포** → 각 기기에서 암호를 다시 입력하라는 화면이 뜹니다.
(암호를 바꾸면 기존 기기들은 다음 요청 때 자동으로 다시 입력 화면이 나옵니다.)

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| 암호 화면에 "서버 설정이 아직 끝나지 않았습니다" | 환경 변수 4개 등록 여부, 등록 후 **다시 배포**했는지 |
| "서버에 연결할 수 없습니다" | 배포가 끝났는지, 주소가 맞는지, 인터넷 연결 |
| 카카오 권한 오류 안내창 | REST API 키가 맞는지, 카카오맵(로컬) 사용 설정 ON 인지. 안내창 아래 "서버 응답" 문구를 참고 |
| 일정이 안 불러와짐 | `JSONBIN_BIN_ID`, `JSONBIN_MASTER_KEY` 값 |
| 휴대폰을 잃어버림 | 접속 암호를 바꾸고 다시 배포 |

## GitHub로 바꾸고 싶을 때

이 폴더 구조 그대로 비공개 저장소에 올리고 Netlify에서 저장소를 연결하면 됩니다. 설정은 `netlify.toml`에 들어 있습니다.
