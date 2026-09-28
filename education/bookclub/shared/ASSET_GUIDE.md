# PRESENCE 독서발표회 · 재사용 가능한 장면 골조

## 구성

- `shared/keynote.css`: 탐색·원고·타이머·전체화면·반응형 레이아웃.
- `shared/keynote.js`: `.slide` 개수를 읽는 공통 엔진. 키보드·터치·해시 이동과 접근성 상태를 처리합니다.
- `shared/thought-field.css` / `thought-field.js`: 독립 궤도로 흐르는 텍스트와 입자.
- `shared/scenes.css`: 책의 이미지 위에 텍스트를 배치하는 인용·클로징 장면.
- 각 책의 `book.js`: 저자, 도입 원고, 장별 원고, 키워드, 장 제목, 검증된 출처.
- 각 책의 `index.html`: 읽는 순서, 실제 인용·적용 내용, 장면별 이미지.
- 각 책의 `assets/`: 해당 책의 의미와 상황에 맞춰 만든 이미지. 엔진은 공유하고 이미지는 책마다 새로 제작합니다.

## 다음 책을 실제로 시작하기

저장소 루트에서 다음 명령을 실행합니다.

```sh
node education/bookclub/template/create-book.cjs next-book "다음 책 제목" "저자 이름"
```

`education/bookclub/next-book/`에 공통 엔진을 사용하는 네 장짜리 HTML, `book.js`, 원고, `assets/`가 생성됩니다. 초안은 갤러리에 자동 등록되지 않습니다. 기존 폴더는 덮어쓰지 않습니다. 생성된 HTML은 로컬 파일로도 열립니다. 다음 순서로 완성합니다.

1. `book.js`의 원고와 키워드, HTML의 핵심 세 문장·인용·실천을 책에 맞게 작성합니다.
2. 인용은 원문·판본·쪽수·출처를 확인합니다. 공개 자료가 페이지 범위를 제시하면 범위를 그대로 표기합니다.
3. 각 장의 의미에 맞는 이미지와 책 표지를 준비합니다.
4. `data-title`과 `data-chapter`를 설정합니다. 슬라이드를 복제/삭제해도 하단 총 장수와 이동 범위는 자동 계산됩니다.
5. PC 1440×900, 태블릿 1024×768, 모바일 390×844에서 본문·출처·컨트롤을 확인합니다.
6. 완성된 책을 갤러리 카탈로그에 등록합니다. 초안 상태의 자리표시자는 등록하지 않습니다.

## 장면 계약

인용 장면은 다음 구조를 공유합니다. `--scene-accent`로 해당 장의 강조색을 지정할 수 있습니다. 번호는 산세리프 tabular 숫자이고 음수 자간을 사용하지 않습니다.

```html
<section class="slide quote cinematic-quote" data-kind="cinematic"
  data-title="인용 제목" data-chapter="02 / SENTENCES" hidden>
  <img class="scene-art" src="assets/quote-01.jpg" alt=""
    width="1672" height="941" decoding="async">
  <div class="scene-shade" aria-hidden="true"></div>
  <div class="scene-copy">
    <p class="eyebrow">02 / SENTENCES</p>
    <p class="quote-theme">핵심 주제</p>
    <blockquote>검증한 문장과 <em>강조할 구절</em></blockquote>
    <div class="page-number"><span>PAGE</span><strong>100</strong></div>
    <p class="quote-foot">판본과 출처</p>
  </div>
</section>
```

- 인용 이미지: 가로 16:9, 최소 1600px 폭. 왼쪽 약 60%는 어두운 여백, 오른쪽 1/3은 시각적 중심. 책의 구절과 연결되는 단일 비유를 사용합니다.
- 모바일: 오른쪽의 중심 대상을 위쪽에 보이게 크롭하고, 아래쪽을 어둡게 처리해 본문과 페이지를 읽게 합니다. 글은 이미지에 넣지 않습니다.
- 클로징: `.horizon-closing`, `.closing-composition`, `.closing-declaration`. 중앙 상단에 충분한 여백, 낮은 지평선 또는 차분한 공간. 인용 장면의 이미지를 복제하지 않습니다.
- 키워드: `book.words`의 `[텍스트, x비율, y비율, 기준크기, 색상클래스]`. `mobileWordPositions`는 모바일 위치입니다. 큰 핵심어 2–3개와 작은 파편을 섞습니다. 텍스트는 DOM이므로 고해상도에서도 선명합니다.
- 동작 줄이기와 모션 OFF를 존중합니다. 다른 장이나 원고 창에서는 텍스트 필드의 프레임 계산을 멈춥니다.
- 이미지 출처/제작 도구/프롬프트와 파일명을 `assets/prompts.json`에 기록합니다. 원본을 보존하고 배포본을 별도로 만듭니다.

## 콘텐츠 설정

`window.PresenceBook`의 `introduction`은 `[구간명, 본문]` 배열, `slideNotes`와 `chapters`는 슬라이드 순서의 배열입니다. `introSlide`는 0부터 시작합니다. `slideSources`는 슬라이드 인덱스별 `{label,url}` 배열입니다. `sources`는 핵심 요약의 근거 팝업으로 `{title,intro,sections:[{heading,text,links}]}` 형태입니다. 외부 출처 링크는 HTTPS만 표시합니다.

본문은 직접 인용/발표자의 해석/실천 약속을 구분합니다. 이미지의 인물과 장소는 개념 표현이며 실제 저자나 사건의 기록으로 소개하지 않습니다.
