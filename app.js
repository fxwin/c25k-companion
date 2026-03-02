/* ===== C25K Companion — app.js ===== */
(function () {
  'use strict';

  // ─── Workout plan ───────────────────────────────────────────
  // Each segment: { type: 'warmup'|'jog'|'walk', duration: seconds }
  // For repeating blocks we build full segment lists so timers are explicit.
  function warmup() { return { type: 'warmup', duration: 300 }; }

  function alternate(jogSec, walkSec, totalMinutes) {
    const segs = [];
    const totalSec = totalMinutes * 60;
    let elapsed = 0;
    while (elapsed < totalSec) {
      segs.push({ type: 'jog', duration: jogSec });
      elapsed += jogSec;
      if (elapsed >= totalSec) break;
      segs.push({ type: 'walk', duration: walkSec });
      elapsed += walkSec;
    }
    return segs;
  }

  const PLAN = [
    // Test workout (remove before going live)
    { week: 0, day: 1, segments: [
      { type: 'warmup', duration: 5 },
      { type: 'jog', duration: 3 }, { type: 'walk', duration: 3 },
      { type: 'jog', duration: 3 }, { type: 'walk', duration: 3 },
      { type: 'jog', duration: 3 }, { type: 'walk', duration: 3 },
      { type: 'jog', duration: 3 }, { type: 'walk', duration: 3 },
    ]},
    // Week 1
    { week: 1, day: 1, segments: [warmup(), ...alternate(60, 90, 20)] },
    { week: 1, day: 2, segments: [warmup(), ...alternate(60, 90, 20)] },
    { week: 1, day: 3, segments: [warmup(), ...alternate(60, 90, 20)] },
    // Week 2
    { week: 2, day: 1, segments: [warmup(), ...alternate(90, 120, 20)] },
    { week: 2, day: 2, segments: [warmup(), ...alternate(90, 120, 20)] },
    { week: 2, day: 3, segments: [warmup(), ...alternate(90, 120, 20)] },
    // Week 3
    ...[1, 2, 3].map(d => ({
      week: 3, day: d, segments: [
        warmup(),
        { type: 'jog', duration: 90 }, { type: 'walk', duration: 90 },
        { type: 'jog', duration: 180 }, { type: 'walk', duration: 180 },
        { type: 'jog', duration: 90 }, { type: 'walk', duration: 90 },
        { type: 'jog', duration: 180 }, { type: 'walk', duration: 180 },
      ]
    })),
    // Week 4
    ...[1, 2, 3].map(d => ({
      week: 4, day: d, segments: [
        warmup(),
        { type: 'jog', duration: 180 }, { type: 'walk', duration: 90 },
        { type: 'jog', duration: 300 }, { type: 'walk', duration: 150 },
        { type: 'jog', duration: 180 }, { type: 'walk', duration: 90 },
        { type: 'jog', duration: 300 },
      ]
    })),
    // Week 5
    {
      week: 5, day: 1, segments: [
        warmup(),
        { type: 'jog', duration: 300 }, { type: 'walk', duration: 180 },
        { type: 'jog', duration: 300 }, { type: 'walk', duration: 180 },
        { type: 'jog', duration: 300 },
      ]
    },
    {
      week: 5, day: 2, segments: [
        warmup(),
        { type: 'jog', duration: 480 }, { type: 'walk', duration: 300 },
        { type: 'jog', duration: 480 },
      ]
    },
    {
      week: 5, day: 3, segments: [warmup(), { type: 'jog', duration: 1200 }]
    },
    // Week 6
    {
      week: 6, day: 1, segments: [
        warmup(),
        { type: 'jog', duration: 300 }, { type: 'walk', duration: 180 },
        { type: 'jog', duration: 480 }, { type: 'walk', duration: 180 },
        { type: 'jog', duration: 300 },
      ]
    },
    {
      week: 6, day: 2, segments: [
        warmup(),
        { type: 'jog', duration: 600 }, { type: 'walk', duration: 180 },
        { type: 'jog', duration: 600 },
      ]
    },
    {
      week: 6, day: 3, segments: [warmup(), { type: 'jog', duration: 1500 }]
    },
    // Week 7
    ...[1, 2, 3].map(d => ({
      week: 7, day: d, segments: [warmup(), { type: 'jog', duration: 1500 }]
    })),
    // Week 8
    ...[1, 2, 3].map(d => ({
      week: 8, day: d, segments: [warmup(), { type: 'jog', duration: 1680 }]
    })),
    // Week 9
    ...[1, 2, 3].map(d => ({
      week: 9, day: d, segments: [warmup(), { type: 'jog', duration: 1800 }]
    })),
  ];

  // ─── Helpers ────────────────────────────────────────────────
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function fmtDuration(sec) {
    if (sec >= 3600) {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      return `${h}h ${m}m`;
    }
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  function totalDuration(segments) {
    return segments.reduce((a, s) => a + s.duration, 0);
  }

  function hasOverride() {
    return data.overrideWorkoutIdx !== null && data.overrideWorkoutIdx !== undefined;
  }

  function getRecommendedIndex() {
    return hasOverride() ? data.overrideWorkoutIdx : data.currentWorkout;
  }

  function workoutLabel(w) { return `Week ${w.week} · Day ${w.day}`; }

  function workoutDescription(w) {
    const parts = w.segments.map(s => {
      const d = fmtDuration(s.duration);
      if (s.type === 'warmup') return `${d} warmup walk`;
      if (s.type === 'jog') return `${d} jog`;
      return `${d} walk`;
    });
    return parts.join(' → ');
  }

  // ─── Audio beep (Web Audio API — won't pause music) ────────
  let audioCtx = null;
  function beep(freq, ms) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.18;
      osc.start();
      osc.stop(audioCtx.currentTime + ms / 1000);
    } catch (_) { /* silent fail */ }
  }
  function beepTransition() { beep(880, 150); setTimeout(() => beep(880, 150), 200); }
  function beepDone() { beep(1047, 150); setTimeout(() => beep(1319, 150), 180); setTimeout(() => beep(1568, 300), 360); }

  // ─── Vibration helper ──────────────────────────────────────
  function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // ─── LocalStorage ──────────────────────────────────────────
  const STORAGE_KEY = 'c25k_data';
  function loadData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  }
  function saveData(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
  function getData() {
    const d = loadData();
    if (!d.workoutDays) d.workoutDays = null;   // [1,3,5] etc
    if (!d.currentWorkout) d.currentWorkout = 0; // index in PLAN
    if (!d.history) d.history = [];
    if (d.raceDate === undefined) d.raceDate = null; // ISO date string or null
    if (d.overrideWorkoutIdx === undefined) d.overrideWorkoutIdx = null; // manual override
    if (d.programOverviewOpen === undefined) d.programOverviewOpen = false;
    return d;
  }

  // ─── Race countdown ────────────────────────────────────────
  function raceCountdownText() {
    if (!data.raceDate) return null;
    const raceDate = new Date(data.raceDate + 'T00:00:00');
    const now = new Date();
    const diff = raceDate - now;
    if (diff <= 0) return 'Race day!';
    const days = Math.ceil(diff / 86400000);
    return `${days} day${days === 1 ? '' : 's'} to race`;
  }

  // ─── Next workout day text ─────────────────────────────────
  function nextWorkoutText(workoutDays) {
    if (!workoutDays || workoutDays.length === 0) return '';
    const now = new Date();
    const today = now.getDay(); // 0=Sun
    // Find next workout day (including today)
    const sorted = [...workoutDays].sort((a, b) => a - b);
    let minDist = 8;
    for (const wd of sorted) {
      let dist = (wd - today + 7) % 7;
      if (dist < minDist) minDist = dist;
    }
    if (minDist === 0) return '📅 Next workout: Today!';
    if (minDist === 1) return '📅 Next workout: Tomorrow';
    return `📅 Next workout: in ${minDist} days`;
  }

  // ─── Show/hide screens ─────────────────────────────────────
  function showScreen(id) {
    $$('.screen').forEach(s => s.hidden = true);
    $(id).hidden = false;
    window.scrollTo(0, 0);
  }

  // ─── Build timeline bar for a workout ──────────────────────
  function buildTimelineBar(container, segments) {
    container.innerHTML = '';
    const total = totalDuration(segments);
    segments.forEach(s => {
      const el = document.createElement('div');
      el.className = `seg seg-${s.type}`;
      el.style.flex = `${s.duration / total}`;
      const dur = s.duration >= 60 ? `${Math.round(s.duration / 60)}m` : `${s.duration}s`;
      el.textContent = s.duration / total > 0.08 ? dur : '';
      container.appendChild(el);
    });
  }

  // ─── Build active timeline list (condensed: done / current / next / remaining) ─
  function buildActiveTimeline(container, segments, activeIdx) {
    container.innerHTML = '';

    function segLabel(s) {
      return s.type === 'warmup' ? 'Warmup Walk' : s.type === 'jog' ? 'Jog' : 'Walk';
    }

    // 1) Completed sections
    if (activeIdx > 0) {
      const doneTime = segments.slice(0, activeIdx).reduce((a, s) => a + s.duration, 0);
      const el = document.createElement('div');
      el.className = 'tl-item done';
      el.innerHTML = `<span class="tl-dot"></span><span>${activeIdx} section${activeIdx > 1 ? 's' : ''} completed</span><span class="tl-dur">${fmtDuration(doneTime)}</span>`;
      container.appendChild(el);
    }

    // 2) Current section
    const cur = segments[activeIdx];
    const curEl = document.createElement('div');
    curEl.className = 'tl-item active';
    curEl.innerHTML = `<span class="tl-dot"></span><span>${segLabel(cur)}</span><span class="tl-dur">${fmtDuration(cur.duration)}</span>`;
    container.appendChild(curEl);

    // 3) Next section
    if (activeIdx + 1 < segments.length) {
      const nxt = segments[activeIdx + 1];
      const nxtEl = document.createElement('div');
      nxtEl.className = 'tl-item';
      nxtEl.innerHTML = `<span class="tl-dot"></span><span>Up next: ${segLabel(nxt)}</span><span class="tl-dur">${fmtDuration(nxt.duration)}</span>`;
      container.appendChild(nxtEl);
    }

    // 4) Remaining sections after next
    const remainStart = activeIdx + 2;
    if (remainStart < segments.length) {
      const remainCount = segments.length - remainStart;
      const remainTime = segments.slice(remainStart).reduce((a, s) => a + s.duration, 0);
      const remEl = document.createElement('div');
      remEl.className = 'tl-item remaining';
      remEl.innerHTML = `<span class="tl-dot"></span><span>${remainCount} more section${remainCount > 1 ? 's' : ''}</span><span class="tl-dur">${fmtDuration(remainTime)}</span>`;
      container.appendChild(remEl);
    }
  }

  // ─── Build program overview (expandable week list) ─────────
  function buildProgramOverview() {
    const container = $('#program-weeks');
    container.innerHTML = '';
    const currentIdx = data.currentWorkout;

    for (let week = 1; week <= 9; week++) {
      const weekWorkouts = PLAN.filter(w => w.week === week);
      const firstIdx = PLAN.indexOf(weekWorkouts[0]);
      const lastIdx = PLAN.indexOf(weekWorkouts[weekWorkouts.length - 1]);

      const details = document.createElement('details');
      details.className = 'week-group';

      // Auto-open the current week
      const isCurrent = currentIdx >= firstIdx && currentIdx <= lastIdx;
      const isDone = currentIdx > lastIdx;
      if (isCurrent) details.open = true;

      let badge = '';
      if (isDone) badge = '<span class="week-badge badge-done">Done</span>';
      else if (isCurrent) badge = '<span class="week-badge badge-current">Current</span>';

      const summary = document.createElement('summary');
      summary.innerHTML = `Week ${week}${badge}`;
      details.appendChild(summary);

      const list = document.createElement('div');
      list.className = 'wo-list';

      weekWorkouts.forEach(w => {
        const woIdx = PLAN.indexOf(w);
        const done = woIdx < currentIdx;
        const current = woIdx === currentIdx;
        const selected = hasOverride() && data.overrideWorkoutIdx === woIdx;

        const wrapper = document.createElement('div');
        wrapper.className = 'wo-list-entry';

        const el = document.createElement('div');
        el.className = 'wo-list-item' + (done ? ' wo-done' : '') + (current ? ' wo-current' : '') + (selected ? ' wo-selected' : '');
        el.style.cursor = 'pointer';

        const checkContent = done ? '\u2713' : '';
        const dur = fmtDuration(totalDuration(w.segments));
        el.innerHTML = `
          <span class="wo-check">${checkContent}</span>
          <span>Day ${w.day}</span>
          <span class="wo-actions">
            <button class="btn btn-link btn-muted wo-set-next-inline" data-idx="${woIdx}">Set next</button>
            <span class="wo-dur">${dur}</span>
          </span>
        `;
        wrapper.appendChild(el);

        // Expandable workout preview
        const preview = document.createElement('div');
        preview.className = 'wo-preview';
        preview.hidden = true;
        preview.innerHTML = `
          <div class="timeline-legend wo-legend">
            <span class="legend-item"><span class="legend-swatch seg-warmup"></span>Warmup</span>
            <span class="legend-item"><span class="legend-swatch seg-jog"></span>Jog</span>
            <span class="legend-item"><span class="legend-swatch seg-walk"></span>Walk</span>
          </div>
          <div class="timeline-preview wo-timeline"></div>
          <div class="workout-total-time">Total: ${dur}</div>
        `;
        wrapper.appendChild(preview);

        const setBtn = el.querySelector('.wo-set-next-inline');
        setBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (woIdx === data.currentWorkout) {
            data.overrideWorkoutIdx = null;
          } else {
            data.overrideWorkoutIdx = woIdx;
          }
          saveData(data);
          showHome();
        });

        el.addEventListener('click', () => {
          const isOpen = !preview.hidden;
          // Close all other previews in this week
          list.querySelectorAll('.wo-preview').forEach(p => p.hidden = true);
          list.querySelectorAll('.wo-list-item').forEach(i => i.classList.remove('wo-expanded'));
          if (!isOpen) {
            preview.hidden = false;
            el.classList.add('wo-expanded');
            // Build timeline bar on first open
            const tlContainer = preview.querySelector('.wo-timeline');
            if (!tlContainer.hasChildNodes()) {
              buildTimelineBar(tlContainer, w.segments);
            }
          }
        });

        list.appendChild(wrapper);
      });

      details.appendChild(list);
      container.appendChild(details);
    }
  }

  // ─── APP STATE ─────────────────────────────────────────────
  let data = getData();
  let activeWorkout = null;  // PLAN entry
  let timerInterval = null;
  let segIdx = 0;
  let segElapsed = 0;   // seconds elapsed in current segment
  let totalElapsed = 0; // seconds elapsed overall
  let isRunning = false;
  let selectedRating = 0;
  let transitionCountdown = 0; // 5-second buffer between segments
  const TRANSITION_SECS = 5;

  // ─── SETUP SCREEN ─────────────────────────────────────────
  function initSetup() {
    const selected = new Set();
    $$('.day-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = Number(btn.dataset.day);
        if (selected.has(day)) { selected.delete(day); btn.classList.remove('selected'); }
        else if (selected.size < 3) { selected.add(day); btn.classList.add('selected'); }
        $('#setup-done-btn').disabled = selected.size !== 3;
        $('#day-hint').textContent = selected.size === 3 ? 'Great choices!' : `Select ${3 - selected.size} more`;
      });
    });
    $('#setup-done-btn').addEventListener('click', () => {
      data.workoutDays = [...selected];
      // Save optional race date
      const raceDateVal = $('#race-date-input').value;
      data.raceDate = raceDateVal || null;
      saveData(data);
      showHome();
    });
  }

  // ─── HOME SCREEN ──────────────────────────────────────────
  function showHome() {
    if (!data.workoutDays) { showScreen('#setup-screen'); return; }
    showScreen('#home-screen');

    // Race countdown
    const countdownText = raceCountdownText();
    const countdownEl = $('#race-countdown');
    if (countdownText) {
      countdownEl.textContent = countdownText;
      countdownEl.hidden = false;
    } else {
      countdownEl.textContent = '';
      countdownEl.hidden = true;
    }

    // Next workout day
    $('#next-workout-info').textContent = nextWorkoutText(data.workoutDays);

    const overrideActive = hasOverride();
    const idx = getRecommendedIndex();
    if (idx >= PLAN.length) {
      // Program complete
      $('.recommended-card').hidden = true;
      $('#program-complete-msg').hidden = false;
      $('#reset-recommend-btn').hidden = true;
      return;
    }
    $('.recommended-card').hidden = false;
    $('#program-complete-msg').hidden = true;

    $('#recommended-label').textContent = overrideActive ? 'Selected Workout' : 'Recommended Workout';
    if (overrideActive) {
      const rec = PLAN[data.currentWorkout];
      const recLabel = rec ? workoutLabel(rec) : 'Recommended Workout';
      $('#reset-recommend-btn').textContent = `Reset to Recommended (${recLabel})`;
      $('#reset-recommend-btn').hidden = false;
    } else {
      $('#reset-recommend-btn').hidden = true;
    }

    const w = PLAN[idx];
    $('#workout-title').textContent = workoutLabel(w);
    buildTimelineBar($('#workout-preview-timeline'), w.segments);
    $('#workout-total-time').textContent = `Total: ${fmtDuration(totalDuration(w.segments))}`;

    // Build program overview
    buildProgramOverview();
    const overviewEl = $('#program-overview');
    if (overviewEl) overviewEl.open = !!data.programOverviewOpen;
  }

  // ─── WORKOUT SCREEN ───────────────────────────────────────
  function startWorkout(workout) {
    activeWorkout = workout;
    segIdx = 0;
    segElapsed = 0;
    totalElapsed = 0;
    isRunning = false;

    showScreen('#workout-screen');
    $('#active-workout-title').textContent = workoutLabel(workout);
    renderWorkoutState();
    updateControls();
  }

  function renderWorkoutState() {
    // If in transition countdown, show "Get Ready" state
    if (transitionCountdown > 0) {
      const nextSeg = activeWorkout.segments[segIdx];
      const typeEl = $('#segment-type');
      const nextLabel = nextSeg.type === 'warmup' ? 'Warmup Walk' : nextSeg.type === 'jog' ? 'Jog' : 'Walk';
      typeEl.textContent = `Get Ready: ${nextLabel}`;
      typeEl.className = 'segment-type type-transition';
      $('#segment-timer').textContent = fmtTime(transitionCountdown);
      $('#segment-remaining').textContent = `Segment ${segIdx + 1} of ${activeWorkout.segments.length}`;

      // Progress (don't advance during transition)
      const total = totalDuration(activeWorkout.segments);
      const pct = Math.min(100, (totalElapsed / total) * 100);
      $('#total-progress-bar').style.width = pct + '%';
      $('#total-time-display').textContent = `${fmtTime(totalElapsed)} / ${fmtTime(total)}`;

      buildActiveTimeline($('#active-timeline'), activeWorkout.segments, segIdx);
      return;
    }

    const seg = activeWorkout.segments[segIdx];
    const remaining = seg.duration - segElapsed;

    // Segment display
    const typeEl = $('#segment-type');
    typeEl.textContent = seg.type === 'warmup' ? 'Warmup Walk' : seg.type === 'jog' ? 'Jog' : 'Walk';
    typeEl.className = 'segment-type type-' + seg.type;
    $('#segment-timer').textContent = fmtTime(remaining);
    $('#segment-remaining').textContent = `Segment ${segIdx + 1} of ${activeWorkout.segments.length}`;

    // Progress
    const total = totalDuration(activeWorkout.segments);
    const pct = Math.min(100, (totalElapsed / total) * 100);
    $('#total-progress-bar').style.width = pct + '%';
    $('#total-time-display').textContent = `${fmtTime(totalElapsed)} / ${fmtTime(total)}`;

    // Active timeline
    buildActiveTimeline($('#active-timeline'), activeWorkout.segments, segIdx);
  }

  function tick() {
    // Handle transition countdown first
    if (transitionCountdown > 0) {
      transitionCountdown--;
      if (transitionCountdown === 0) {
        // Transition done, start the segment
        beepTransition();
        vibrate([200, 100, 200]);
      }
      renderWorkoutState();
      return;
    }

    segElapsed++;
    totalElapsed++;

    const seg = activeWorkout.segments[segIdx];
    if (segElapsed >= seg.duration) {
      // Move to next segment
      segIdx++;
      segElapsed = 0;
      if (segIdx >= activeWorkout.segments.length) {
        // Workout complete
        stopTimer();
        beepDone();
        vibrate([200, 100, 200, 100, 400]);
        showComplete();
        return;
      }
      // Start transition countdown
      transitionCountdown = TRANSITION_SECS;
      beep(660, 200);
    }

    renderWorkoutState();
  }

  function startTimer() {
    if (timerInterval) return;
    // Ensure AudioContext is unlocked by user gesture
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isRunning = true;
    timerInterval = setInterval(tick, 1000);
    updateControls();
  }

  function stopTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    updateControls();
  }

  function restartWorkout() {
    stopTimer();
    segIdx = 0;
    segElapsed = 0;
    totalElapsed = 0;
    transitionCountdown = 0;
    renderWorkoutState();
    updateControls();
  }

  function updateControls() {
    const btn = $('#ctrl-start-stop');
    btn.textContent = isRunning ? 'Pause' : (totalElapsed > 0 ? 'Resume' : 'Start');
    if (isRunning) {
      btn.classList.add('btn-pause');
    } else {
      btn.classList.remove('btn-pause');
    }
  }

  // ─── COMPLETE SCREEN ──────────────────────────────────────
  function showComplete() {
    showScreen('#complete-screen');
    selectedRating = 0;
    $$('.rating-btn').forEach(b => b.classList.remove('selected'));
    $('#complete-done-btn').disabled = true;
    $('#complete-workout-name').textContent = workoutLabel(activeWorkout);
    $('#complete-duration').textContent = `Duration: ${fmtDuration(totalElapsed)}`;
  }

  function saveCompleted() {
    const woIdx = getRecommendedIndex();
    data.history.push({
      workoutIdx: woIdx,
      label: workoutLabel(activeWorkout),
      date: new Date().toISOString(),
      duration: totalElapsed,
      rating: selectedRating,
    });
    // Advance currentWorkout past this workout if it's at or beyond it
    if (woIdx >= data.currentWorkout) {
      data.currentWorkout = woIdx + 1;
    }
    // Always clear override after completing a workout
    data.overrideWorkoutIdx = null;
    saveData(data);
    activeWorkout = null;
    showHome();
  }

  // ─── Recalculate currentWorkout from history ──────────────
  function recalcCurrentWorkout() {
    if (data.history.length === 0) {
      data.currentWorkout = 0;
    } else {
      // Take the latest entry's workoutIdx and go to the next one
      const latest = data.history[data.history.length - 1];
      data.currentWorkout = latest.workoutIdx + 1;
    }
    saveData(data);
  }

  // ─── HISTORY SCREEN ───────────────────────────────────────
  function showHistory() {
    showScreen('#history-screen');
    const list = $('#history-list');
    list.innerHTML = '';
    if (data.history.length === 0) {
      $('#history-empty').hidden = false;
      $('#history-clear-btn').hidden = true;
      return;
    }
    $('#history-empty').hidden = true;
    $('#history-clear-btn').hidden = false;
    const ratingEmojis = ['', '😫', '😕', '😐', '🙂', '😄'];
    // Show newest first
    [...data.history].reverse().forEach((h, ri) => {
      const realIdx = data.history.length - 1 - ri;
      const d = new Date(h.date);
      const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="hi-left">
          <div class="hi-name">${h.label}</div>
          <div class="hi-date">${dateStr} · ${timeStr}</div>
          <div class="hi-duration">${fmtDuration(h.duration)}</div>
        </div>
        <div class="hi-rating">${ratingEmojis[h.rating] || ''}</div>
        <button class="hi-delete" data-idx="${realIdx}" title="Delete">✕</button>
      `;
      list.appendChild(el);
    });

    // Wire up individual delete buttons
    list.querySelectorAll('.hi-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        if (confirm('Delete this workout entry?')) {
          data.history.splice(idx, 1);
          recalcCurrentWorkout();
          showHistory();
        }
      });
    });
  }

  // ─── EVENT WIRING ─────────────────────────────────────────
  function init() {
    data = getData();
    initSetup();

    // Home buttons
    $('#start-btn').addEventListener('click', () => {
      const idx = getRecommendedIndex();
      if (idx < PLAN.length) startWorkout(PLAN[idx]);
    });
    $('#history-btn').addEventListener('click', showHistory);
    $('#settings-btn').addEventListener('click', () => {
      // Reset day picker UI but keep data until confirmed
      $$('.day-btn').forEach(b => b.classList.remove('selected'));
      $('#setup-done-btn').disabled = true;
      $('#day-hint').textContent = 'Select exactly 3 days';
      // Pre-fill race date if previously set
      $('#race-date-input').value = data.raceDate || '';
      $('#setup-back-btn').hidden = false;
      showScreen('#setup-screen');
    });

    // Workout controls
    $('#ctrl-start-stop').addEventListener('click', () => {
      if (isRunning) stopTimer(); else startTimer();
    });
    $('#ctrl-restart').addEventListener('click', restartWorkout);
    $('#workout-back-btn').addEventListener('click', () => {
      stopTimer();
      showHome();
    });

    // Rating buttons
    $$('.rating-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedRating = Number(btn.dataset.rating);
        $$('.rating-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        $('#complete-done-btn').disabled = false;
      });
    });
    $('#complete-done-btn').addEventListener('click', saveCompleted);

    // History back
    $('#history-back-btn').addEventListener('click', showHome);

    const overviewEl = $('#program-overview');
    if (overviewEl) {
      overviewEl.addEventListener('toggle', () => {
        data.programOverviewOpen = overviewEl.open;
        saveData(data);
      });
    }

    // Setup back (return without changing days)
    $('#setup-back-btn').addEventListener('click', () => {
      showHome();
    });

    // Reset override to recommended workout
    $('#reset-recommend-btn').addEventListener('click', () => {
      data.overrideWorkoutIdx = null;
      saveData(data);
      showHome();
    });

    // Clear all history
    $('#history-clear-btn').addEventListener('click', () => {
      if (confirm('Delete all workout history? This will reset your progress.')) {
        data.history = [];
        recalcCurrentWorkout();
        showHistory();
      }
    });

    // Initial screen
    showHome();
  }

  // Prevent screen from sleeping during workout (if supported)
  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (_) {}
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    init();
    // Poll to manage wake lock based on running state
    setInterval(() => {
      if (isRunning && !wakeLock) requestWakeLock();
      if (!isRunning && wakeLock) releaseWakeLock();
    }, 2000);
  });
})();
