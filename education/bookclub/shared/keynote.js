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

  const book = window.PresenceBook || {};
  const introduction = book.introduction || [];
  const slideNotes = book.slideNotes || [];

  slides.forEach((slide, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = String(index + 1).padStart(2, '0');
    option.title = slide.dataset.title || book.title || '독서발표회';
    slide.setAttribute('aria-label', `${index + 1} / ${slides.length} ${option.title}`);
    option.setAttribute('aria-label', `${String(index + 1).padStart(2, '0')} · ${slide.dataset.title}`);
    $('#slideSelect').append(option);
  });

  $('.total').textContent = '/ ' + String(slides.length).padStart(2, '0');

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
    document.body.dataset.sceneKind = slides[current].dataset.kind || 'standard';
    $('#slideSelect').value = String(current);
    $('#prev').disabled = current === 0;
    $('#next').disabled = current === slides.length - 1;
    $('#progressFill').style.width = `${((current + 1) / slides.length) * 100}%`;
    $('#chapter').textContent = slides[current].dataset.chapter || book.chapters?.[current] || 'READING SESSION';
    $('#slideAnnouncement').textContent = `${current + 1} / ${slides.length}. ${slides[current].dataset.title}`;
    if (updateHistory) history.replaceState(null, '', `#slide-${current + 1}`);
    window.scrollTo({top:0, behavior:'instant'});
    $('#keynote').scrollTop = 0;
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
    return String(text ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function openNotes(intro = current === (book.introSlide ?? 1) && introduction.length > 0) {
    lastFocus = document.activeElement;
    $('#notesTitle').textContent = intro ? '책을 읽고 느낀 점 · 약 3분' : slides[current].dataset.title;
    $('#notesBody').innerHTML = intro
      ? '<p class="note-caption">보통 속도로 읽고 문단 사이에 잠깐 쉬는 약 3분 원고입니다. 말하는 속도에 맞춰 타이머로 리허설해 보세요. 원고 창은 청중 화면에도 보입니다.</p>' + introduction.map(([time, text]) => `<h3>${escapeHTML(time)}</h3><p>${escapeHTML(text)}</p>`).join('')
      : `<p>${escapeHTML(slideNotes[current] || '이 장의 발표 원고를 준비하고 있습니다.').replace(/\n\n/g, '</p><p>')}</p>`;
    if (!intro && book.slideSources?.[current]) $('#notesBody').innerHTML += sourceLinks(book.slideSources[current]);
    $('#timerTools').hidden = !intro;
    document.body.classList.add('notes-open');
    notes.showModal();
    $('#notesBody').scrollTop = 0;
    $('#closeNotes').focus();
  }
  function sourceLinks(links = []) {
    return '<p class="note-caption source-links">' + links.filter(link => /^https:\/\//.test(link.url || '')).map(link => `<a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.label)} ↗</a>`).join('<br>') + '</p>';
  }
  function openSources() {
    const sources = book.sources;
    if (!sources) return;
    lastFocus = document.activeElement;
    $('#notesTitle').textContent = sources.title || '참고 자료';
    $('#notesBody').innerHTML = `<p class="note-caption">${escapeHTML(sources.intro)}</p>` + (sources.sections || []).map(section => `<h3>${escapeHTML(section.heading)}</h3><p>${escapeHTML(section.text)}</p>${sourceLinks(section.links)}`).join('');
    $('#timerTools').hidden = true;
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
  $('#introButton')?.addEventListener('click', () => openNotes(true));
  $('#sourceButton')?.addEventListener('click', openSources);
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
  }
  $('#fullscreen').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', syncFullscreen);
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
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) document.body.classList.add('paused');
    else syncMotion();
  });
  syncMotion();
  showSlide(routeIndex(), false);
})();
