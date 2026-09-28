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
      })
    ])
  });
})();
