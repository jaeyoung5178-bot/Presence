/* Presentation-only enhancements. Sales records and their original module are unchanged. */
(() => {
  'use strict';
  const START_DATE = '2023-11-01';
  const NO_ZERO_START_DATE = '2024-11-02';
  const DAY_MS = 86400000;
  const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
  const $ = id => document.getElementById(id);
  const number = value => new Intl.NumberFormat('ko-KR').format(value);

  function parseISODate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new RangeError('Use a YYYY-MM-DD calendar date.');
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) throw new RangeError('Invalid calendar date.');
    return date;
  }
  function isoDate(date) { return date.toISOString().slice(0, 10); }
  function koreanDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = type => parts.find(part => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function addMonths(date, months) {
    const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(date.getUTCDate(), last)));
  }
  function daysBetween(from, to) {
    const a = typeof from === 'string' ? parseISODate(from) : from;
    const b = typeof to === 'string' ? parseISODate(to) : to;
    return Math.round((b.getTime() - a.getTime()) / DAY_MS);
  }
  function calendarDuration(startISO, endISO) {
    const start = parseISODate(startISO), end = parseISODate(endISO);
    if (end < start) return { years: 0, months: 0, days: 0 };
    let totalMonths = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
    if (addMonths(start, totalMonths) > end) totalMonths--;
    return { years: Math.floor(totalMonths / 12), months: totalMonths % 12, days: daysBetween(addMonths(start, totalMonths), end) };
  }
  function calculateJourney(asOf = koreanDate(), startISO = START_DATE) {
    const start = parseISODate(startISO), end = parseISODate(asOf);
    const elapsedDays = Math.max(0, daysBetween(start, end));
    const duration = calendarDuration(startISO, asOf);
    const completedYears = duration.years;
    const previousAnniversary = addMonths(start, completedYears * 12);
    const nextAnniversary = addMonths(start, (completedYears + 1) * 12);
    const anniversaryDays = daysBetween(previousAnniversary, nextAnniversary);
    const anniversaryElapsed = Math.max(0, daysBetween(previousAnniversary, end));
    return {
      startDate: startISO, asOf, ...duration, elapsedDays,
      inclusiveDays: end < start ? 0 : elapsedDays + 1,
      durationText: `${duration.years}년 ${duration.months}개월 ${duration.days}일`,
      anniversaryNumber: completedYears + 1,
      previousAnniversary: isoDate(previousAnniversary), nextAnniversary: isoDate(nextAnniversary),
      daysUntilAnniversary: daysBetween(end, nextAnniversary),
      anniversaryElapsed, anniversaryDays,
      progress: Math.min(100, Math.max(0, anniversaryElapsed / anniversaryDays * 100))
    };
  }
  function calculateNoZeroJourney(asOf = koreanDate()) {
    return calculateJourney(asOf, NO_ZERO_START_DATE);
  }
  function shortDate(iso) { return iso.replaceAll('-', '. ') + '.'; }
  let midnightTimer;
  function refreshJourney() {
    const journey = calculateJourney();
    if (!$('journeyDuration')) return journey;
    const noZero = calculateNoZeroJourney(journey.asOf);
    if ($('noZeroDuration')) {
      $('noZeroDuration').textContent = noZero.durationText;
      $('noZeroDay').textContent = `${number(noZero.inclusiveDays)}일`;
      $('noZeroElapsed').textContent = `총 ${number(noZero.elapsedDays)}일 경과`;
      $('noZeroAsOf').textContent = shortDate(noZero.asOf);
      $('noZeroAsOf').dateTime = noZero.asOf;
    }
    $('journeyDuration').textContent = journey.durationText;
    $('journeyDay').textContent = `${number(journey.inclusiveDays)}일`;
    $('journeyElapsed').textContent = `총 ${number(journey.elapsedDays)}일 경과`;
    $('journeyAsOf').textContent = shortDate(journey.asOf);
    $('journeyAsOf').dateTime = journey.asOf;
    $('journeyMilestone').textContent = `다음 이정표 · 근무 ${journey.anniversaryNumber}주년`;
    $('journeyCountdown').textContent = `${number(journey.daysUntilAnniversary)}일 남았어요`;
    $('journeyLastAnniversary').textContent = `${shortDate(journey.previousAnniversary)} ${journey.anniversaryNumber === 1 ? '출발' : `${journey.anniversaryNumber - 1}주년`}`;
    $('journeyNextAnniversary').textContent = `${shortDate(journey.nextAnniversary)} ${journey.anniversaryNumber}주년`;
    $('journeyProgressFill').style.width = `${journey.progress}%`;
    $('journeyProgress').setAttribute('aria-valuenow', String(Math.round(journey.progress)));
    $('journeyProgress').setAttribute('aria-valuetext', `${journey.anniversaryNumber}주년까지 ${journey.daysUntilAnniversary}일, 지난 기념일부터 ${journey.anniversaryElapsed}일 경과`);
    clearTimeout(midnightTimer);
    const nextMidnight = parseISODate(journey.asOf).getTime() + DAY_MS - SEOUL_OFFSET_MS;
    midnightTimer = setTimeout(refreshJourney, Math.max(1000, nextMidnight - Date.now() + 100));
    return journey;
  }
  window.PresenceJourney = Object.freeze({ START_DATE, NO_ZERO_START_DATE, DAY_MS, parseISODate, koreanDate, getSeoulDate: koreanDate, calendarDuration, daysBetween, addMonths, calculateJourney, calculateNoZeroJourney, getJourney: calculateJourney, refresh: refreshJourney });

  const html = document.documentElement;
  function readPreference(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function savePreference(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* Private browsing still supports session controls. */ } }
  function setTheme(theme) {
    html.dataset.recordTheme = theme;
    const night = theme === 'night', label = night ? '낮 테마로 바꾸기' : '밤 테마로 바꾸기';
    $('recordTheme').setAttribute('aria-pressed', String(night));
    $('recordTheme').setAttribute('aria-label', label);
    $('recordTheme').title = label;
    $('recordTheme').firstElementChild.textContent = night ? '☀' : '☾';
    document.querySelector('meta[name="theme-color"]').content = night ? '#182722' : '#f7f7ee';
  }
  setTheme(readPreference('presence_record_theme') === 'night' ? 'night' : 'light');
  $('recordTheme').addEventListener('click', () => {
    const theme = html.dataset.recordTheme === 'night' ? 'light' : 'night';
    setTheme(theme); savePreference('presence_record_theme', theme);
  });

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function setMotion() {
    const off = reducedMotion.matches || readPreference('presence_record_motion') === 'off';
    html.dataset.recordMotion = off ? 'off' : 'on';
    const label = reducedMotion.matches ? '움직임 꺼짐 · 기기 설정 적용 중' : off ? '잔잔한 움직임 켜기' : '잔잔한 움직임 끄기';
    $('recordMotion').setAttribute('aria-pressed', String(off));
    $('recordMotion').setAttribute('aria-label', label);
    $('recordMotion').title = label;
    $('recordMotion').firstElementChild.textContent = off ? '∿' : '≈';
  }
  setMotion();
  reducedMotion.addEventListener('change', setMotion);
  $('recordMotion').addEventListener('click', () => {
    savePreference('presence_record_motion', html.dataset.recordMotion === 'off' ? 'on' : 'off');
    setMotion();
  });

  let notesOpen = readPreference('presence-rn-open') !== '0';
  function setNotesOpen() {
    $('rnWrap').style.display = notesOpen ? '' : 'none';
    $('rnToggle').setAttribute('aria-expanded', String(notesOpen));
    $('rnArrow').textContent = notesOpen ? '▾ 접기' : '▸ 펼치기';
  }
  setNotesOpen();
  $('rnToggle').addEventListener('click', () => { notesOpen = !notesOpen; setNotesOpen(); savePreference('presence-rn-open', notesOpen ? '1' : '0'); });

  function labelControls(scope) {
    scope.querySelectorAll('.fld').forEach(field => {
      const label = field.querySelector('label'), controls = field.querySelectorAll('input, select, textarea');
      if (label && controls[0]?.id) label.htmlFor = controls[0].id;
      controls.forEach((control, index) => {
        if (index > 0 || !label) control.setAttribute('aria-label', control.placeholder || label?.textContent || '기록 입력');
      });
    });
    scope.querySelectorAll('input, select, textarea').forEach(control => {
      if (!control.labels?.length && !control.getAttribute('aria-label')) control.setAttribute('aria-label', control.placeholder || '기록 입력');
    });
    scope.querySelectorAll('button').forEach(button => {
      if (!button.hasAttribute('type')) button.type = 'button';
      if (button.matches('.del')) {
        const row = button.closest('tr'), context = row ? Array.from(row.cells).slice(0, 2).map(cell => cell.textContent.trim()).join(' ') : '기록';
        button.setAttribute('aria-label', `${context} ${button.hasAttribute('data-edit') ? '수정' : '삭제'}`);
      }
    });
  }
  labelControls(document);

  let activeDialog = null, returnFocus = null;
  const page = document.querySelector('.wrap');
  function positionDialogClose() {
    if (!activeDialog?.isConnected) return;
    const close = activeDialog.querySelector('.record-dialog-close');
    const box = activeDialog.firstElementChild;
    if (!close || !box) return;
    const bounds = box.getBoundingClientRect();
    close.style.top = `${bounds.top + 12}px`;
    close.style.left = `${bounds.right - 60}px`;
  }
  function enhanceDialog() {
    const overlay = $('rnEditOv');
    if (overlay === activeDialog) return;
    if (activeDialog) {
      page.inert = false;
      document.body.classList.remove('record-dialog-open');
      const focusTarget = returnFocus?.isConnected ? returnFocus : $('rnToggle');
      focusTarget?.focus({ preventScroll: true });
      activeDialog = null;
    }
    if (!overlay) return;
    returnFocus = document.activeElement;
    activeDialog = overlay;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '후원자 기록 수정');
    labelControls(overlay);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'record-dialog-close';
    close.textContent = '닫기';
    close.setAttribute('aria-label', '후원자 수정 창 닫기');
    close.addEventListener('click', () => overlay.remove());
    overlay.appendChild(close);
    positionDialogClose();
    page.inert = true;
    document.body.classList.add('record-dialog-open');
    overlay.querySelector('input, select, textarea, button')?.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', event => {
    if (!activeDialog?.isConnected) return;
    if (event.key === 'Escape') { event.preventDefault(); activeDialog.remove(); return; }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(activeDialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')).filter(node => !node.disabled && node.getClientRects().length);
    if (!focusable.length) { event.preventDefault(); return; }
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !activeDialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  });
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === 1) {
        if (node.matches('button.del')) labelControls(node.parentElement);
        else if (node.querySelector('input, button, textarea, select')) labelControls(node);
      }
    }
    enhanceDialog();
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', positionDialogClose);
  window.visualViewport?.addEventListener('resize', positionDialogClose);
  refreshJourney();
  window.addEventListener('focus', refreshJourney);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshJourney(); });
})();
