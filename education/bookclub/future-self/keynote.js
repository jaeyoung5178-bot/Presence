(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const slides = [...document.querySelectorAll('.slide')];
  const notes = $('#notes');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let motionPaused = reducedMotion.matches;
  let lastFocus = null;
  let timeRemaining = 180;
  let timerRunning = false;
  let timerDeadline = 0;
  let timerInterval = null;

  const introduction = [
    ['00:00–00:30 / 나를 멈추게 한 질문', '이 책을 다 읽고 가장 오래 남은 건 질문 하나였습니다. 이미 내가 바라는 삶을 살고 있는 미래의 나라면, 지금의 나에게 무엇을 부탁할까? 저는 그 질문 앞에서 오늘을 다시 보게 됐습니다. 부모님께 드릴 전화, 자꾸 미루는 운동, 리쿠르팅을 위한 한 통의 전화가 떠올랐습니다. 그 일들을 미룰 때마다 미래의 내가 원했던 하루도 조금씩 멀어지고 있었던 겁니다. 책을 덮고 나니, 평범한 오늘이 내 미래를 결정하는 시간처럼 느껴졌습니다.'],
    ['00:30–01:00 / 미래의 나와 연결하기', '퓨처 셀프의 중심에는 미래의 나와 연결된다는 생각이 있습니다. 내가 되고 싶은 사람이 선명해지면 지금 무엇을 중요하게 여길지, 어디에 시간을 쓸지 달라집니다. 막연하게 잘되고 싶다는 마음을, 어떤 관계를 맺고 어떤 몸으로 어떤 일을 하는 사람이 될 것인지로 구체화하는 거죠. 미래의 내가 낯설고 멀리 있을 때는 오늘의 편안함이 늘 이겼습니다. 그 사람이 바로 나라는 감각이 생기니, 오늘 조금 불편하더라도 지키고 싶은 일이 보이기 시작했습니다.'],
    ['01:00–01:30 / 정체성이 선택의 기준이 될 때', '그래서 저는 선택의 기준을 바꿔보기로 했습니다. 이미 건강을 잘 관리하는 나라면 오늘 무엇을 먹고 어떻게 움직일까? 이미 지점을 운영하는 나라면, 거절 한 번에 얼마나 오래 머물러 있을까? 바라는 모습으로 나를 바라보니 해야 할 일의 의미가 달라졌습니다. 운동은 미래의 몸을 돌보는 일이 되고, 콜링은 함께 일할 사람을 만날 기회가 됩니다. 지금의 부족함을 인정하면서도, 앞으로 어떤 사람이 될지는 오늘의 행동으로 계속 선택할 수 있다는 점이 인상 깊었습니다.'],
    ['01:30–02:00 / 우선순위를 실제 일정으로', '그 선택을 이어가려면 우선순위가 필요합니다. 하고 싶은 일을 끝없이 늘리는 대신, 내 미래에 중요한 일을 먼저 정하고 시간을 확보하는 겁니다. 저에게는 가족과의 소통, 리쿠르팅, 건강이 그 기준입니다. 좋은 결심도 일정에 자리가 없으면 쉽게 밀립니다. 그래서 전화할 시간을 정하고, 콜링 시간을 확보하고, 자기 전에 운동하는 순서를 만들려고 합니다. 의지가 흔들리는 날에도 다시 시작할 수 있도록, 내가 머무는 환경과 하루의 순서까지 미래의 나를 돕는 쪽으로 바꾸고 싶습니다.'],
    ['02:00–02:30 / 용기와 의도적인 연습', '물론 미래의 나를 그린다고 불편함이 사라지지는 않습니다. 거절은 여전히 신경 쓰이고, 운동은 귀찮고, 새로운 시도는 어색합니다. 그래서 책에서 만난 용기라는 단어가 오래 남았습니다. 가치 있는 목표를 위해 위험을 감수하는 태도. 저는 그것을 다음 전화를 거는 행동으로 받아들였습니다. 완벽하게 준비될 때까지 기다리는 시간이 길어질수록 배우는 시간은 늦어집니다. 작은 행동을 하고, 결과를 돌아보고, 다음 시도를 조금 바꾸는 의도적인 연습이 나의 미래를 더 가까이 데려온다고 느꼈습니다.'],
    ['02:30–03:00 / 내가 가져온 결론', '결국 제가 이 책에서 가져온 결론은 미래의 내가 고마워할 오늘을 살자는 것입니다. 미래를 생각할수록 지금 곁에 있는 가족과 내 몸, 함께 일할 사람들이 더 소중해졌습니다. 그래서 부모님께 매주 한 번 전화하고, 콜링에 주 세 시간을 쓰고, 자기 전 삼십 분은 운동하기로 했습니다. 이번 주말에는 비전보드도 만들겠습니다. 바라는 모습을 눈앞에 두고, 그 사람이라면 할 선택을 하루에 하나씩 쌓아가고 싶습니다. 이제 제가 오래 붙들고 싶었던 세 문장과, 제 삶에 적용한 약속을 나누겠습니다.']
  ];
  const slideNotes = [
    '오늘 발표의 제목은 “미래의 내가, 오늘을 살게 하라”입니다. 『퓨처 셀프』를 다 읽고 나서, 이미 목표를 이룬 미래의 내가 오늘의 나에게 무엇을 부탁할지 생각해 봤습니다. 책의 핵심을 먼저 소개하고, 마음에 남은 세 구절과 제가 적용한 행동을 나누겠습니다.',
    '',
    '첫 번째로 표시한 문장입니다. 이 구절을 읽고 저는 지금 반복하는 하루가 어떤 미래로 이어지는지 돌아봤습니다. 가족, 리쿠르팅, 건강에 쓰는 시간을 바라보니 평범한 행동에도 방향이 생겼습니다. 화면의 문장과 77쪽은 제가 기록해 둔 구절과 쪽수입니다.',
    '두 번째 문장은 용기에 관한 것입니다. 저에게 용기는 리쿠르팅에서 거절을 감수하고 다음 전화를 거는 태도와 연결됐습니다. 가치 있다고 믿는 목표를 위해 불편함을 받아들이고 행동해 보자는 다짐입니다. 화면의 문장과 122쪽은 제가 기록해 둔 구절과 쪽수입니다.',
    '세 번째로 함께 나누고 싶은 문장입니다. 저는 미래의 나를 선명하게 느낄수록 오늘 할 일이 구체적으로 보인다는 뜻으로 받아들였습니다. 이 인용은 2023년판의 프롤로그를 소개한 YES24와 국회도서관의 공개 발췌로 확인했습니다. 출처가 27~28쪽 범위로 표기하고 있어 같은 범위로 표시했습니다. 판본에 따라 쪽수는 다를 수 있습니다.',
    '첫 번째 적용은 미래의 내가 부탁한 일을 미루지 않는 것입니다. 가족에게는 부모님께 주 한 번 안부전화 드리기. 리쿠르팅에는 한 주에 누적 세 시간 이상 콜링에 투자하고 최소 열 부킹을 목표로 하기. 건강에는 지독하게 귀찮아도 자기 전에 삼십 분 운동하기입니다. 미래의 내가 살려 달라고 보내는 절실한 목소리를 듣는다고 생각하면, 오늘의 작은 행동이 가볍게 느껴지지 않습니다.',
    '두 번째 적용은 구체적으로 꿈꾸는 미래를 눈앞에 놓아보는 것입니다. 이번 주말까지 나의 비전보드를 만들겠습니다. 직접 그림을 그리거나 이미 제가 원하는 삶을 사는 사람의 모습을 스크랩해도 좋습니다. 가족과 함께하는 일상, 건강한 몸, 함께 성장하는 지점을 제 눈으로 볼 수 있을 만큼 구체적으로 담아보고 싶습니다.',
    '세 번째 적용은 이미 이룬 사람의 기준으로 선택하는 것입니다. 이미 건강관리에 성공한 사람처럼 건강을 해치는 행동이나 음식이 내가 원하는 삶에 어울리지 않는다고 생각해 보려 합니다. 이미 지점을 운영하는 사람처럼 불필요한 네거티브에 오래 머물지 않고, 해야 할 일을 하고, 나와 상대에게 함께 도움이 되는 윈윈을 선택하려고 합니다. 현재를 속이는 것이 아니라 오늘의 선택 기준을 세우는 연습입니다.',
    '미래의 내가 고마워할 오늘을 만들겠습니다. 전화 한 통, 확보한 콜링 시간, 자기 전 삼십 분 운동. 제가 바라는 미래가 오늘의 선택으로 이어지기를 바랍니다. 들어주셔서 감사합니다.'
  ];

  slides.forEach((slide, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = String(index + 1).padStart(2, '0');
    option.title = slide.dataset.title;
    option.setAttribute('aria-label', `${String(index + 1).padStart(2, '0')} · ${slide.dataset.title}`);
    $('#slideSelect').append(option);
  });

  function positionRiver() {
    if (current !== 1) return;
    const field = $('.river-space').getBoundingClientRect();
    const stage = $('#slides').getBoundingClientRect();
    document.body.style.setProperty('--river-top', `${field.top - stage.top}px`);
  }
  function routeIndex() {
    const match = location.hash.match(/^#slide-(\d+)$/);
    return match ? Math.max(0, Math.min(slides.length - 1, Number(match[1]) - 1)) : 0;
  }
  function showSlide(index, updateHistory = true) {
    current = Math.max(0, Math.min(slides.length - 1, Number(index) || 0));
    slides.forEach((slide, i) => {
      slide.hidden = i !== current;
      slide.classList.toggle('active', i === current);
      slide.setAttribute('aria-hidden', String(i !== current));
    });
    if (document.activeElement.closest('.slide[hidden]')) $('#slides').focus({preventScroll:true});
    document.body.dataset.scene = String(current);
    $('#slideSelect').value = String(current);
    $('#prev').disabled = current === 0;
    $('#next').disabled = current === slides.length - 1;
    $('#progressFill').style.width = `${((current + 1) / slides.length) * 100}%`;
    $('#chapter').textContent = current === 0 ? 'INTRODUCTION' : current === 1 ? '01 / THE ESSENCE' : current < 5 ? '02 / THREE SENTENCES' : current < 8 ? '03 / MY PRACTICE' : 'MY FUTURE SELF';
    $('#slideAnnouncement').textContent = `${current + 1} / ${slides.length}. ${slides[current].dataset.title}`;
    if (updateHistory) history.replaceState(null, '', `#slide-${current + 1}`);
    window.scrollTo({top:0, behavior:'instant'});
    $('#keynote').scrollTop = 0;
    requestAnimationFrame(positionRiver);
  }
  function syncMotion() {
    document.body.classList.toggle('paused', motionPaused);
    $('#motion').setAttribute('aria-pressed', String(motionPaused));
    $('#motion').title = motionPaused ? '애니메이션 재생' : '애니메이션 멈추기';
    $('#motion span').textContent = motionPaused ? 'OFF' : 'ON';
  }
  function status(message) {
    $('#status').textContent = message;
    $('#status').classList.add('show');
    clearTimeout(status.timeout);
    status.timeout = setTimeout(() => $('#status').classList.remove('show'), 4500);
  }
  function escapeHTML(text) {
    return text.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function openNotes(intro = current === 1) {
    lastFocus = document.activeElement;
    $('#notesTitle').textContent = intro ? '책을 읽고 느낀 점 · 약 3분' : slides[current].dataset.title;
    $('#notesBody').innerHTML = intro
      ? '<p class="note-caption">보통 속도로 읽고 문단 사이에 잠깐 쉬는 약 3분 원고입니다. 말하는 속도에 맞춰 타이머로 리허설해 보세요. 원고 창은 청중 화면에도 보입니다.</p>' + introduction.map(([time, text]) => `<h3>${escapeHTML(time)}</h3><p>${escapeHTML(text)}</p>`).join('')
      : `<p>${escapeHTML(slideNotes[current])}</p>`;
    if (current === 4 && !intro) $('#notesBody').innerHTML += '<p class="note-caption">인용 확인: <a href="https://www.yes24.com/Product/Goods/122090360" target="_blank" rel="noopener noreferrer">YES24 책 속으로</a> · <a href="https://dl.nanet.go.kr/detail/MONO12023000053464" target="_blank" rel="noopener noreferrer">국회도서관 도서 정보</a><br>2023년판 ISBN 9791192389325, 프롤로그 27–28쪽.</p>';
    $('#timerTools').hidden = !intro;
    document.body.classList.add('notes-open');
    notes.showModal();
    $('#notesBody').scrollTop = 0;
    $('#closeNotes').focus();
  }
  function renderTimer() {
    const seconds = Math.max(0, Math.ceil(timeRemaining));
    $('#timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    $('#timerToggle').textContent = timerRunning ? '일시정지' : timeRemaining <= 0 ? '다시 시작' : timeRemaining < 180 ? '계속하기' : '3분 시작';
  }
  function pauseTimer() {
    if (timerRunning) timeRemaining = Math.max(0, (timerDeadline - performance.now()) / 1000);
    timerRunning = false;
    clearInterval(timerInterval);
    renderTimer();
  }
  $('#timerToggle').addEventListener('click', () => {
    if (timerRunning) { pauseTimer(); return; }
    if (timeRemaining <= 0) timeRemaining = 180;
    $('#timerStatus').textContent = '';
    timerRunning = true;
    timerDeadline = performance.now() + timeRemaining * 1000;
    renderTimer();
    timerInterval = setInterval(() => {
      timeRemaining = Math.max(0, (timerDeadline - performance.now()) / 1000);
      if (timeRemaining <= 0) {
        pauseTimer();
        $('#timerStatus').textContent = '3분이 지났습니다.';
      }
      renderTimer();
    }, 200);
  });
  $('#timerReset').addEventListener('click', () => { pauseTimer(); timeRemaining = 180; $('#timerStatus').textContent = ''; renderTimer(); });
  $('#notesButton').addEventListener('click', () => openNotes());
  $('#introButton').addEventListener('click', () => openNotes(true));
  $('#closeNotes').addEventListener('click', () => notes.close());
  notes.addEventListener('close', () => { pauseTimer(); document.body.classList.remove('notes-open'); lastFocus?.focus(); });
  notes.addEventListener('click', (event) => {
    if (event.target !== notes) return;
    const box = notes.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) notes.close();
  });
  $('#prev').addEventListener('click', () => showSlide(current - 1));
  $('#next').addEventListener('click', () => showSlide(current + 1));
  $('#slideSelect').addEventListener('change', (event) => showSlide(event.target.value));
  document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => showSlide(button.dataset.go)));
  $('#motion').addEventListener('click', () => {
    if (reducedMotion.matches) { status('기기의 동작 줄이기 설정을 따르고 있습니다.'); return; }
    motionPaused = !motionPaused;
    syncMotion();
  });
  reducedMotion.addEventListener('change', () => { motionPaused = reducedMotion.matches; syncMotion(); });

  function syncFullscreen() {
    const active = !!document.fullscreenElement || document.body.classList.contains('cinema');
    $('#fullscreen').innerHTML = active ? '화면 복귀 <span aria-hidden="true">⛶</span>' : '전체화면 <span aria-hidden="true">⛶</span>';
    $('#fullscreen').setAttribute('aria-pressed', String(active));
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.body.classList.contains('cinema')) document.body.classList.remove('cinema');
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else { document.body.classList.add('cinema'); status('브라우저 안에서 발표 화면을 확대했습니다.'); }
    } catch (_) {
      document.body.classList.toggle('cinema');
      status('브라우저 안에서 발표 화면을 확대했습니다.');
    }
    syncFullscreen();
    requestAnimationFrame(positionRiver);
  }
  $('#fullscreen').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => { syncFullscreen(); requestAnimationFrame(positionRiver); });
  document.addEventListener('keydown', (event) => {
    if (notes.open || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable]')) return;
    if (event.key === 'Escape' && document.body.classList.contains('cinema')) { document.body.classList.remove('cinema'); syncFullscreen(); return; }
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || (event.key === ' ' && !event.target.closest('button,a'))) { event.preventDefault(); showSlide(current + 1); }
    else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); showSlide(current - 1); }
    else if (event.key === 'Home') { event.preventDefault(); showSlide(0); }
    else if (event.key === 'End') { event.preventDefault(); showSlide(slides.length - 1); }
    else if (event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFullscreen(); }
    else if (event.key.toLowerCase() === 'n') { event.preventDefault(); openNotes(); }
  });
  let touch = null;
  $('#slides').addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1 || event.target.closest('a,button,select')) return;
    touch = {x:event.touches[0].clientX,y:event.touches[0].clientY};
  }, {passive:true});
  $('#slides').addEventListener('touchend', (event) => {
    if (!touch) return;
    const dx = event.changedTouches[0].clientX - touch.x;
    const dy = event.changedTouches[0].clientY - touch.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) showSlide(current + (dx < 0 ? 1 : -1));
    touch = null;
  }, {passive:true});
  $('#slides').addEventListener('touchcancel', () => { touch = null; }, {passive:true});
  addEventListener('hashchange', () => showSlide(routeIndex(), false));
  addEventListener('resize', positionRiver);
  new ResizeObserver(positionRiver).observe($('.essence'));
  document.fonts.ready.then(positionRiver);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) document.body.classList.add('paused');
    else syncMotion();
  });
  syncMotion();
  showSlide(routeIndex(), false);
})();
