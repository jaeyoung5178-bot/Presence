# Presence Crew Camp

운영 경로: https://hub.presence.co.kr/recruiting/index.html
체험 경로: https://hub.presence.co.kr/recruiting/index.html?demo=1

기존 워크북 계정 인증을 사용합니다. `recapStudio` Firebase 앱과 `authSessions`의 활성 계정 검증을 재사용하고, 본인만 읽고 쓸 수 있는 `userPreferences/{uid}/recruitingCamp`에 후보자, 설정, 제출 확인 기록을 저장합니다. 다른 계정의 기록을 조회하지 않습니다. 서버 보안 규칙은 변경하지 않았습니다.

후보자별 당일 열람은 1회 집계합니다. 통화 결과는 날짜별 이벤트로 남고, 이후 재연락 결과가 과거 보고를 바꾸지 않습니다. 부킹·쇼업·스타터는 발생일 기준입니다. 구글 폼에는 해당 날짜에 열람한 후보자의 그날 최종 통화 결과를 채웁니다. 폼 제출은 사용자가 확인 후 수행합니다. SMS·카카오톡은 문구 복사 기능입니다. 실발송하지 않습니다.

통화 메모와 릴레이트 포인트는 기존 후보자에서 자동 저장합니다. 다른 입력은 저장 버튼으로 기록합니다. 저장 실패 시 이 탭의 sessionStorage에 임시 보관하며, 동시 수정 충돌 시 원격 기록을 덮어쓰지 않습니다. 체험 모드는 온라인 기록에 쓰지 않습니다. 실제 예시 후보자·전화번호는 초기 데이터로 넣지 않았습니다.

## 검증

`node recruiting/model.test.mjs`: 날짜·요일, 주·월 범위, 당일 중복 열람, 과거 보고 보존, 단계 검증, 폼 entry 매핑, 시트 수식 방어.

`node recruiting/verify.cjs`: 390×844, 1024×768, 1440×900에서 member / leader / admin 9개 조합. 실제 앱 및 저장 모듈에 Firebase SDK 응답만 가상으로 제공해, 본인 경로 저장·통화·부재·부킹·문자·쇼업·스타터·보고 집계와 화면 넘침/터치 크기를 확인합니다. 실제 후보자 데이터는 쓰지 않습니다. 배포 후 `CREW_QA_URL=https://hub.presence.co.kr`로 같은 검증을 반복합니다.

실제 워크북 계정의 운영 저장 및 로그인된 알바몬에서의 확장앱 연동은 사용자 세션에서 별도 확인이 필요합니다. 알바몬 링크 자동 가져오기는 확장앱 연결 확장 작업 중입니다. 초기 도우미는 전화번호를 열람한 페이지에서 후보자 입력창을 준비합니다.

## 디자인 참고

- Nintendo Kirby Waddle Dee Town: https://www.nintendo.com/sg/switch/arzg/town/index.html — 동료와 함께 자라는 아늑한 거점, 실제 성과에 따른 수집 배지로 재해석.
- tvN 지구오락실: https://tvn.cjenm.com/ko/eartharcade2/ — 밝은 모험과 미션 분위기, 퀘스트·스티커·성공 피드백으로 재해석.
- CookieRun Kingdom 공식 소개: https://hub.cookierun-kingdom.com/about — 동료와 함께 만드는 공간이라는 관계 중심 서사 참고.
- 웨일 확장앱 공식 안내: https://help.whale.naver.com/ko/desktop/store/

원본 작품의 캐릭터·이미지·로고는 사용하지 않았습니다. 전용 일러스트와 아이콘 아틀라스는 built-in image_gen으로 생성했습니다. 최종 PNG 원본 및 WebP 최적화본은 assets/에 있습니다. 프롬프트는 ASSET-PROMPTS.txt에 기록합니다. 버튼·성공 별가루, 미세한 호흡 모션, 선택적 Web Audio 효과를 사용합니다. 소리는 기본 꺼짐이고 reduced-motion 및 모션 줄이기를 지원합니다.
