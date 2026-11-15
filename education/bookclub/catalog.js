/* Publish only finished, verified presentations here. No network or database writes. */
(function () {
  'use strict';
  window.PresenceBookCatalog = Object.freeze({
    schemaVersion: 1,
    books: Object.freeze([
      Object.freeze({
        slug: 'future-self',
        status: 'ready',
        title: '퓨처 셀프',
        originalTitle: 'Be Your Future Self Now',
        author: '벤저민 하디',
        translator: '최은아',
        publisher: '상상스퀘어',
        edition: '30만 부 기념 스페셜 에디션',
        year: 2024,
        isbn: '9791198854315',
        cover: 'https://image.yes24.com/goods/133809700/XL',
        source: 'https://www.yes24.com/Product/Goods/133809700',
        presentationTitle: '미래의 내가, 오늘을 살게 하라.',
        description: '미래의 나를 선명하게 만나고, 오늘의 선택과 행동을 다시 정하는 시간.',
        tags: Object.freeze(['정체성', '미래의 나', '실천']),
        slides: 9,
        introMinutes: 3,
        href: 'education/bookclub/future-self/index.html#slide-1'
      }),
      Object.freeze({
        slug: 'hey-have-you-tried',
        status: 'ready',
        title: '정주영 이봐, 해봤어?',
        author: '박정웅',
        publisher: '프리이코노미북스',
        edition: '2015년판',
        year: 2015,
        isbn: '9788963740904',
        cover: 'education/bookclub/hey-have-you-tried/assets/cover.jpg',
        source: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=50896607',
        presentationTitle: '가능성은 행동으로 증명한다.',
        description: '중동·조선소·포니의 세 장면에서, 리쿠르팅과 팀을 성장시키는 실행의 원리를 찾다.',
        tags: Object.freeze(['도전', '실행', '리더십']),
        slides: 5,
        href: 'education/bookclub/hey-have-you-tried/index.html#slide-1'
      })
    ])
  });
})();
