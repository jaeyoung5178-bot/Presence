(function () {
  'use strict';

  function escape(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function presentationUrl(value) {
    return typeof value === 'string' && /^education\/bookclub\/[a-z0-9]+(?:-[a-z0-9]+)*\/index\.html(?:#slide-[1-9]\d*)?$/.test(value) ? value : '';
  }

  function coverUrl(value) {
    if (typeof value !== 'string') return '';
    if (/^education\/bookclub\/[a-z0-9/-]+\.(?:webp|png|jpe?g)$/i.test(value) && !value.includes('..')) return value;
    try {
      var url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch (_) { return ''; }
  }

  function catalog() {
    var data = window.PresenceBookCatalog;
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.books)) return null;
    return data.books.filter(function (book) {
      return book && book.status === 'ready' && typeof book.title === 'string' && book.title.trim() &&
        typeof book.author === 'string' && book.author.trim() && presentationUrl(book.href);
    });
  }

  function cover(book, index) {
    var url = coverUrl(book.cover);
    return '<span class="reading-cover-scene" aria-hidden="true">' +
      '<span class="reading-book-object">' +
        '<span class="reading-book-spine"></span><span class="reading-book-pages"></span>' +
        '<span class="reading-book-front">' +
          '<span class="reading-cover-fallback"><span>BEYOND THE LAST PAGE</span><strong>' + escape(book.title) +
          '</strong><small>' + escape(book.originalTitle || '') + '</small><span>' + escape(book.author) + '</span></span>' +
          (url ? '<img class="reading-cover-image" src="' + escape(url) + '" alt="" width="480" height="700" loading="' + (index ? 'lazy' : 'eager') + '" decoding="async">' : '') +
        '</span>' +
      '</span>' +
      '<span class="reading-book-shadow"></span>' +
    '</span>';
  }

  function bookCard(book, index) {
    var tags = Array.isArray(book.tags) ? book.tags.slice(0, 3) : [];
    var slides = Number.isInteger(book.slides) && book.slides > 0 ? book.slides + '장 키노트' : '키노트';
    var intro = Number.isInteger(book.introMinutes) && book.introMinutes > 0 ? ' · ' + book.introMinutes + '분 도입' : '';
    return '<a class="bookclub-feature reading-book" href="' + escape(presentationUrl(book.href)) + '" aria-label="' + escape(book.title + ' · ' + book.author + ' 독서발표회 시작') + '">' +
      '<span class="reading-book-index"><span>VOL. ' + String(index + 1).padStart(3, '0') + '</span><span>' + escape(book.year || '') + '</span></span>' +
      cover(book, index) +
      '<div class="reading-book-info">' +
        '<span class="reading-book-tags">' + tags.map(function (tag) { return '<span>' + escape(tag) + '</span>'; }).join('') + '</span>' +
        '<h3>' + escape(book.title) + '</h3>' +
        '<span class="reading-author">' + escape(book.author) + ' 지음' + (book.translator ? ' <span>· ' + escape(book.translator) + ' 옮김</span>' : '') + '</span>' +
        '<span class="reading-edition">' + escape(book.publisher || '') + (book.edition ? ' · ' + escape(book.edition) : '') + '</span>' +
        '<span class="reading-presentation-title">' + escape(book.presentationTitle || book.title) + '</span>' +
        '<span class="reading-book-bottom"><span>' + slides + intro + '</span><span class="reading-start">발표 시작 <span aria-hidden="true">↗</span></span></span>' +
      '</div>' +
    '</a>';
  }

  function nextBook() {
    return '<div class="reading-next" aria-label="다음 독서발표회를 위한 빈 자리">' +
      '<span class="reading-next-shape" aria-hidden="true"><span>THE<br>NEXT<br>CHAPTER</span><i></i></span>' +
      '<p>다음 책이 놓일 자리</p><span>한 권씩, 우리의 생각이 쌓입니다.</span>' +
    '</div>';
  }

  function render(options) {
    var books = catalog();
    if (books === null) return '<section class="reading-room reading-room-error" role="status"><p class="reading-room-eyebrow">PRESENCE READING ROOM</p><h2>서가를 불러오지 못했어요.</h2><p>발표는 아래 링크에서 바로 시작할 수 있어요.</p><a class="reading-recovery" href="education/bookclub/future-self/index.html#slide-1">퓨처 셀프 발표 시작 ↗</a></section>';
    var compact = Boolean(options && options.compact);
    return '<section class="reading-room' + (compact ? ' reading-room-compact' : '') + '" aria-label="독서발표회 서가">' +
      '<header class="reading-room-heading"><div><p class="reading-room-eyebrow">PRESENCE READING ROOM</p><h2>읽은 책, 남은 생각.</h2><p class="reading-room-description">책 한 권에서 시작한 변화, 함께 나누는 독서발표회.</p></div>' +
      '<span class="reading-room-count"><strong>' + String(books.length).padStart(2, '0') + '</strong><span>' + (books.length === 1 ? 'BOOK' : 'BOOKS') + ' ON THE SHELF</span></span></header>' +
      (books.length ? '<div class="reading-shelf">' + books.map(bookCard).join('') + (compact ? '' : nextBook()) + '</div>' :
      '<div class="reading-empty" role="status">' + nextBook() + '<p>아직 등록된 발표가 없습니다.<br>준비가 끝난 책부터 이 서가에 모입니다.</p></div>') +
      (!compact && books.length ? '<footer class="reading-room-footer"><span>책을 선택하면 발표가 바로 시작됩니다.</span><span aria-hidden="true">READ · REFLECT · BECOME</span></footer>' : '') +
    '</section>';
  }

  function setContext(active, itemCount) {
    var isBookClub = active === '__BOOKCLUB__';
    document.body.classList.toggle('bookclub-view', isBookClub);
    var count = (catalog() || []).length;
    var bookCount = document.querySelector('#bookclubTab .cnt, #bookclubTab .count');
    if (bookCount) bookCount.textContent = count;
    var totalCount = document.querySelector('[data-f="__ALL__"] .cnt, [data-f="__ALL__"] .count');
    if (totalCount && Number.isInteger(itemCount)) totalCount.textContent = itemCount + count;
    var resultCount = document.querySelector('#resultCount');
    if (resultCount && isBookClub) resultCount.textContent = count + '개의 발표';
    else if (resultCount && active === '__ALL__') resultCount.textContent = document.querySelectorAll('#grid .lesson-card, #grid .reading-book').length + '개의 배움';
    var resultsNote = document.querySelector('#resultsNote');
    if (resultsNote && isBookClub) resultsNote.textContent = '책을 선택하면 발표가 바로 시작됩니다.';
  }

  // A failed external cover never hides the title, author, or presentation link.
  document.addEventListener('error', function (event) {
    var image = event.target;
    if (image instanceof HTMLImageElement && image.classList.contains('reading-cover-image')) image.hidden = true;
  }, true);

  window.PresenceBookGallery = Object.freeze({
    render: render,
    count: function () { return (catalog() || []).length; },
    setContext: setContext
  });
})();
