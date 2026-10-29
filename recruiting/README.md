# Presence Crew Camp

운영 경로: https://hub.presence.co.kr/recruiting/index.html
체험 경로: https://hub.presence.co.kr/recruiting/index.html?demo=1

기존 워크북 계정 인증을 사용합니다. `recapStudio` Firebase 앱과 `authSessions`의 활성 계정 검증을 재사용하고, 본인만 읽고 쓸 수 있는 `userPreferences/{uid}/recruitingCamp`에 후보자, 설정, 제출 확인 기록을 저장합니다. 다른 계정의 기록을 조회하지 않습니다. 서버 보안 규칙은 변경하지 않았습니다.

후보자별 당일 열람은 1회 집계합니다. 통화 결과는 날짜별 이벤트로 남고, 이후 재연락 결과가 과거 보고를 바꾸지 않습니다. 부킹·쇼업·스타터는 발생일 기준입니다. 구글 폼에는 해당 날짜에 열람한 후보자의 그날 최종 통화 결과를 채웁니다. 폼 제출은 사용자가 확인 후 수행합니다. SMS·카카오톡은 문구 복사 기능입니다. 실발송하지 않습니다.

통화 메모와 릴레이트 포인트는 기존 후보자에서 자동 저장합니다. 다른 입력은 저장 버튼으로 기록합니다. 저장 실패 시 이 탭의 sessionStorage에 임시 보관하며, 동시 수정 충돌 시 원격 기록을 덮어쓰지 않습니다. 체험 모드는 온라인 기록에 쓰지 않습니다. 실제 예시 후보자·전화번호는 초기 데이터로 넣지 않았습니다.

## 검증

`node recruiting/model.test.mjs`: 날짜·요일, 주·월 범위, 당일 중복 열람, 과거 보고 보존, 단계 검증, 폼 entry 매핑, 시트 수식 방어.

`node recruiting/verify.cjs`: 390×844, 1024×768, 1440×900에서 member / leader / admin 9개 조합. 실제 앱 및 저장 모듈에 Firebase SDK 응답만 가상으로 제공해, 본인 경로 저장·통화·부재·부킹·문자·쇼업·스타터·보고 집계와 화면 넘침/터치 크기를 확인합니다. 실제 후보자 데이터는 쓰지 않습니다. 배포 후 `CREW_QA_URL=https://hub.presence.co.kr`로 같은 검증을 반복합니다.

웨일 도우미 4.0은 알바몬과 알바천국의 이력서 상세 링크를 받아, 로그인된 해당 사이트에서 이름·나이·연락처·학력·경력·희망조건을 전달합니다. 이름과 유효한 연락처가 공개된 경우 기존 워크북 계정의 후보자와 당일 열람을 자동 저장합니다. 마스킹·로그인 필요·연락처 미공개 상태는 미리보기로 유지하며 열람 실적을 임의로 더하지 않습니다. 열람권·본인인증·연락처 공개 버튼은 사용자가 직접 누릅니다. 비밀번호·쿠키는 캠프로 가져오지 않습니다. 저장 실패 시 입력 내용은 세션 초안으로 보존합니다.

기존 확장앱은 웹 배포만으로 업데이트되지 않습니다. 새 ZIP으로 파일을 교체하고 whale://extensions에서 새로고침한 다음, 추가된 알바천국 사이트 접근 권한을 확인하고 캠프와 이력서 탭을 새로고침해야 합니다. 앱은 확장앱 PING의 `sources`에 `albacheonguk`이 없으면 알바천국 요청을 보내지 않고 업데이트 안내를 보여줍니다. 구버전의 알바몬 가져오기는 그대로 지원합니다. 설치·권한 승인은 사용자가 수행합니다.

`resume-sources.js`가 입력·중복 키·채널의 공통 URL 계약입니다. HTTPS의 정확한 알바몬 www/apex 호스트와 `/human-resources/detail/<숫자ID>`, 알바천국 www/apex 호스트와 `/resume/Detail?adid=<ID>`만 허용합니다. 알바천국 경로는 공식 홈페이지와 실제 로그인된 이력서 탭에서 읽기 전용으로 확인했습니다. `useai`·`inflowtype` 같은 추적 옵션은 제거하고 adid는 보존합니다. 사용자정보 포함 URL, 임의 포트, 제어문자, 외부 리디렉션 매개변수, 중복 adid, 미확인 모바일/로그인/목록 경로는 거부합니다. 알바몬의 기존 경로 기반 중복 키는 유지하고 알바천국 키는 `albacheonguk:<ID>`로 구분합니다. 로그아웃·로그인 전환 시 대기 중인 가져오기 요청을 취소해 이전 계정의 늦은 결과가 새 계정에 저장되지 않도록 합니다.

인터뷰 로그에서 카톡방 면접자 명단을 한 번에 붙여넣고 미리보기 후 저장할 수 있습니다. 중복은 휴대폰+면접일+시간으로 판단합니다. 부킹일을 모르면 일정에만 등록하고 열람·일별 부킹 실적을 만들지 않습니다. 요일은 숫자 날짜를 기준으로 계산합니다. 실제 후보자의 이름·전화번호는 공개 소스나 초기 데이터에 넣지 않습니다.

추가 검증: `node recruiting/interviews.test.mjs`, `node recruiting/verify-import.cjs`, `node recruiting/helper/background.test.cjs`. 5명 일괄 등록과 중복 방지, 3개 화면의 링크→자동 입력→열람 집계, 학력·경력 필드, 확장앱 메시지 출처·URL·탭 소유권·필드 허용 목록을 확인했습니다. 실제 로그인된 웨일에서의 확장앱 작동 확인은 설치 후 진행합니다.

## 디자인 참고

- Nintendo Kirby Waddle Dee Town: https://www.nintendo.com/sg/switch/arzg/town/index.html — 동료와 함께 자라는 아늑한 거점, 실제 성과에 따른 수집 배지로 재해석.
- tvN 지구오락실: https://tvn.cjenm.com/ko/eartharcade2/ — 밝은 모험과 미션 분위기, 퀘스트·스티커·성공 피드백으로 재해석.
- CookieRun Kingdom 공식 소개: https://hub.cookierun-kingdom.com/about — 동료와 함께 만드는 공간이라는 관계 중심 서사 참고.
- 웨일 확장앱 공식 안내: https://help.whale.naver.com/ko/desktop/store/

원본 작품의 캐릭터·이미지·로고는 사용하지 않았습니다. 전용 일러스트와 아이콘 아틀라스는 built-in image_gen으로 생성했습니다. 최종 PNG 원본 및 WebP 최적화본은 assets/에 있습니다. 프롬프트는 ASSET-PROMPTS.txt에 기록합니다. 버튼·성공 별가루, 미세한 호흡 모션, 선택적 Web Audio 효과를 사용합니다. 소리는 기본 꺼짐이고 reduced-motion 및 모션 줄이기를 지원합니다.
