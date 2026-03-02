/* ===== C25K Companion — app.js ===== */
/* App state, screen controllers, event wiring */
(function () {
  'use strict';

  const ns = window.C25K;
  const PLAN = ns.PLAN;
  const { $, $$, fmtTime, fmtDuration, totalDuration, workoutLabel,
          saveData, getData, hasOverride, getRecommendedIndex,
      raceCountdownText, nextWorkoutText,
      distanceMeters, formatDistance,
          beep, beepTransition, beepDone, vibrate,
          showScreen, buildTimelineBar, buildActiveTimeline,
          buildProgramOverview } = ns;

  // ─── APP STATE ─────────────────────────────────────────────
  let data = getData();
  let activeWorkout = null;
  let activeWorkoutIdx = null;
  let timerInterval = null;
  let segIdx = 0;
  let segElapsed = 0;
  let totalElapsed = 0;
  let isRunning = false;
  let selectedRating = 0;
  let transitionCountdown = 0;
  const TRANSITION_SECS = 5;
  let selectedDays = new Set();
  let suppressTransitionAlert = false;
  let watchId = null;
  let track = [];
  let historyMap = null;
  let historyMapLayer = null;

  function persistWorkoutState(status) {
    if (activeWorkoutIdx === null) return;
    data.activeWorkoutState = {
      status: status || 'in-progress',
      workoutIdx: activeWorkoutIdx,
      segIdx,
      segElapsed,
      totalElapsed,
      transitionCountdown,
      isRunning,
      lastTs: Date.now(),
    };
    saveData(data);
  }

  function clearWorkoutState() {
    data.activeWorkoutState = null;
    saveData(data);
  }

  function currentSegmentType() {
    if (!activeWorkout) return 'walk';
    if (transitionCountdown > 0) {
      const nextSeg = activeWorkout.segments[segIdx];
      return nextSeg ? nextSeg.type : 'walk';
    }
    const seg = activeWorkout.segments[segIdx];
    return seg ? seg.type : 'walk';
  }

  function startTracking() {
    if (!navigator.geolocation || watchId !== null) return;
    watchId = navigator.geolocation.watchPosition(
      pos => {
        const point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          ts: Date.now(),
          type: currentSegmentType(),
        };
        track.push(point);
        if (data.activeWorkoutState) data.activeWorkoutState.track = track;
        saveData(data);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  }

  function stopTracking() {
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
    watchId = null;
  }

  function computeTrackStats(trackPoints) {
    const stats = {
      totalDistance: 0,
      totalTime: 0,
      byType: { warmup: { distance: 0, time: 0 }, jog: { distance: 0, time: 0 }, walk: { distance: 0, time: 0 } }
    };
    for (let i = 1; i < trackPoints.length; i++) {
      const a = trackPoints[i - 1];
      const b = trackPoints[i];
      const type = b.type || 'walk';
      const dist = distanceMeters(a, b);
      const dt = Math.max(0, Math.floor((b.ts - a.ts) / 1000));
      stats.totalDistance += dist;
      stats.totalTime += dt;
      if (stats.byType[type]) {
        stats.byType[type].distance += dist;
        stats.byType[type].time += dt;
      }
    }
    return stats;
  }

  function advanceBySeconds(seconds) {
    let remaining = seconds;
    while (remaining > 0 && activeWorkout) {
      if (transitionCountdown > 0) {
        const step = Math.min(remaining, transitionCountdown);
        transitionCountdown -= step;
        remaining -= step;
        continue;
      }

      const seg = activeWorkout.segments[segIdx];
      const segRemain = seg.duration - segElapsed;
      const step = Math.min(remaining, segRemain);
      segElapsed += step;
      totalElapsed += step;
      remaining -= step;

      if (segElapsed >= seg.duration) {
        segIdx++;
        segElapsed = 0;
        if (segIdx >= activeWorkout.segments.length) {
          isRunning = false;
          break;
        }
        transitionCountdown = TRANSITION_SECS;
      }
    }
  }

  function restoreWorkoutState() {
    const state = data.activeWorkoutState;
    if (!state || state.workoutIdx === null || state.workoutIdx === undefined) return false;
    if (state.workoutIdx >= PLAN.length) { clearWorkoutState(); return false; }

    activeWorkoutIdx = state.workoutIdx;
    activeWorkout = PLAN[activeWorkoutIdx];
    segIdx = state.segIdx || 0;
    segElapsed = state.segElapsed || 0;
    totalElapsed = state.totalElapsed || 0;
    transitionCountdown = state.transitionCountdown || 0;
    track = state.track || [];
    isRunning = !!state.isRunning;

    if (isRunning && state.lastTs) {
      const delta = Math.max(0, Math.floor((Date.now() - state.lastTs) / 1000));
      if (delta > 0) {
        advanceBySeconds(delta);
        suppressTransitionAlert = true;
      }
    }

    if (state.status === 'complete' || segIdx >= activeWorkout.segments.length) {
      stopTimer();
      showComplete();
      persistWorkoutState('complete');
      return true;
    }

    showScreen('#workout-screen');
    $('#active-workout-title').textContent = workoutLabel(activeWorkout);
    renderWorkoutState();
    updateControls();

    if (isRunning) {
      startTimer();
      startTracking();
    }
    return true;
  }

  // ─── SETUP SCREEN ─────────────────────────────────────────
  function initSetup() {
    selectedDays = new Set();
    $$('.day-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = Number(btn.dataset.day);
        if (selectedDays.has(day)) { selectedDays.delete(day); btn.classList.remove('selected'); }
        else if (selectedDays.size < 3) { selectedDays.add(day); btn.classList.add('selected'); }
        $('#setup-done-btn').disabled = selectedDays.size !== 3;
        $('#day-hint').textContent = selectedDays.size === 3 ? 'Great choices!' : `Select ${3 - selectedDays.size} more`;
      });
    });
    $('#setup-done-btn').addEventListener('click', () => {
      data.workoutDays = [...selectedDays];
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
    const countdownText = raceCountdownText(data);
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

    const overrideActive = hasOverride(data);
    const idx = getRecommendedIndex(data);
    if (idx >= PLAN.length) {
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
    buildProgramOverview(data, { onSetNext: showHome });
    const overviewEl = $('#program-overview');
    if (overviewEl) overviewEl.open = !!data.programOverviewOpen;
  }

  // ─── WORKOUT SCREEN ───────────────────────────────────────
  function startWorkout(idx) {
    activeWorkoutIdx = idx;
    activeWorkout = PLAN[idx];
    segIdx = 0;
    segElapsed = 0;
    totalElapsed = 0;
    isRunning = false;
    transitionCountdown = 0;
    track = [];

    showScreen('#workout-screen');
    $('#active-workout-title').textContent = workoutLabel(activeWorkout);
    renderWorkoutState();
    updateControls();
    persistWorkoutState('in-progress');
  }

  function renderWorkoutState() {
    if (transitionCountdown > 0) {
      const nextSeg = activeWorkout.segments[segIdx];
      const typeEl = $('#segment-type');
      const nextLabel = nextSeg.type === 'warmup' ? 'Warmup Walk' : nextSeg.type === 'jog' ? 'Jog' : 'Walk';
      typeEl.textContent = `Get Ready: ${nextLabel}`;
      typeEl.className = 'segment-type type-transition';
      $('#segment-timer').textContent = fmtTime(transitionCountdown);
      $('#segment-remaining').textContent = `Segment ${segIdx + 1} of ${activeWorkout.segments.length}`;

      const total = totalDuration(activeWorkout.segments);
      const pct = Math.min(100, (totalElapsed / total) * 100);
      $('#total-progress-bar').style.width = pct + '%';
      $('#total-time-display').textContent = `${fmtTime(totalElapsed)} / ${fmtTime(total)}`;

      buildActiveTimeline($('#active-timeline'), activeWorkout.segments, segIdx);
      return;
    }

    const seg = activeWorkout.segments[segIdx];
    const remaining = seg.duration - segElapsed;

    const typeEl = $('#segment-type');
    typeEl.textContent = seg.type === 'warmup' ? 'Warmup Walk' : seg.type === 'jog' ? 'Jog' : 'Walk';
    typeEl.className = 'segment-type type-' + seg.type;
    $('#segment-timer').textContent = fmtTime(remaining);
    $('#segment-remaining').textContent = `Segment ${segIdx + 1} of ${activeWorkout.segments.length}`;

    const total = totalDuration(activeWorkout.segments);
    const pct = Math.min(100, (totalElapsed / total) * 100);
    $('#total-progress-bar').style.width = pct + '%';
    $('#total-time-display').textContent = `${fmtTime(totalElapsed)} / ${fmtTime(total)}`;

    buildActiveTimeline($('#active-timeline'), activeWorkout.segments, segIdx);
  }

  function tick() {
    if (transitionCountdown > 0) {
      transitionCountdown--;
      if (transitionCountdown === 0) {
        if (suppressTransitionAlert) {
          suppressTransitionAlert = false;
        } else {
          beepTransition();
          vibrate([200, 100, 200]);
        }
      }
      renderWorkoutState();
      if (isRunning) persistWorkoutState('in-progress');
      return;
    }

    segElapsed++;
    totalElapsed++;

    const seg = activeWorkout.segments[segIdx];
    if (segElapsed >= seg.duration) {
      segIdx++;
      segElapsed = 0;
      if (segIdx >= activeWorkout.segments.length) {
        stopTimer();
        beepDone();
        vibrate([200, 100, 200, 100, 400]);
        showComplete();
        persistWorkoutState('complete');
        return;
      }
      transitionCountdown = TRANSITION_SECS;
      beep(660, 200);
    }

    renderWorkoutState();
    if (isRunning) persistWorkoutState('in-progress');
  }

  function startTimer() {
    if (timerInterval) return;
    const ctx = ns.getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    isRunning = true;
    timerInterval = setInterval(tick, 1000);
    updateControls();
    persistWorkoutState('in-progress');
    startTracking();
  }

  function stopTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    updateControls();
    persistWorkoutState('in-progress');
    stopTracking();
  }

  function restartWorkout() {
    stopTimer();
    segIdx = 0;
    segElapsed = 0;
    totalElapsed = 0;
    transitionCountdown = 0;
    track = [];
    renderWorkoutState();
    updateControls();
    persistWorkoutState('in-progress');
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
    persistWorkoutState('complete');
  }

  function saveCompleted() {
    const woIdx = getRecommendedIndex(data);
    const stats = computeTrackStats(track);
    data.history.push({
      workoutIdx: woIdx,
      label: workoutLabel(activeWorkout),
      date: new Date().toISOString(),
      duration: totalElapsed,
      rating: selectedRating,
      track,
      trackStats: stats,
    });
    if (woIdx >= data.currentWorkout) {
      data.currentWorkout = woIdx + 1;
    }
    data.overrideWorkoutIdx = null;
    saveData(data);
    clearWorkoutState();
    activeWorkout = null;
    activeWorkoutIdx = null;
    track = [];
    showHome();
  }

  // ─── Recalculate currentWorkout from history ──────────────
  function recalcCurrentWorkout() {
    if (data.history.length === 0) {
      data.currentWorkout = 0;
    } else {
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
    [...data.history].reverse().forEach((h, ri) => {
      const realIdx = data.history.length - 1 - ri;
      const d = new Date(h.date);
      const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const dist = h.trackStats ? formatDistance(h.trackStats.totalDistance) : 'No GPS';
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="hi-left">
          <div class="hi-name">${h.label}</div>
          <div class="hi-date">${dateStr} · ${timeStr}</div>
          <div class="hi-duration">${fmtDuration(h.duration)}</div>
          <div class="hi-distance">${dist}</div>
        </div>
        <div class="hi-rating">${ratingEmojis[h.rating] || ''}</div>
        <button class="hi-delete" data-idx="${realIdx}" title="Delete">✕</button>
      `;
      el.addEventListener('click', (e) => {
        if (e.target.closest('.hi-delete')) return;
        showHistoryMap(h);
      });
      list.appendChild(el);
    });

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

  function showHistoryMap(entry) {
    const mapWrap = $('#history-map');
    const mapTitle = $('#history-map-title');
    const mapStats = $('#history-map-stats');
    const mapCanvas = $('#history-map-canvas');

    mapWrap.hidden = false;
    mapTitle.textContent = entry.label;
    mapStats.innerHTML = '';

    const stats = entry.trackStats;
    if (!entry.track || entry.track.length < 2 || !stats) {
      mapCanvas.innerHTML = '<div class="hint">No GPS data available for this workout.</div>';
      return;
    }

    const warmupColor = '#FB8C00';
    const jogColor = '#2E7D32';
    const walkColor = '#1E88E5';

    if (!historyMap) {
      historyMap = L.map(mapCanvas);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(historyMap);
    } else {
      historyMap.invalidateSize();
    }

    if (historyMapLayer) {
      historyMap.removeLayer(historyMapLayer);
    }

    const segments = [];
    let current = [];
    let currentType = entry.track[0].type;
    entry.track.forEach((p, i) => {
      if (p.type !== currentType) {
        if (current.length > 1) segments.push({ type: currentType, points: current });
        currentType = p.type;
        current = [];
      }
      current.push([p.lat, p.lng]);
      if (i === entry.track.length - 1 && current.length > 1) {
        segments.push({ type: currentType, points: current });
      }
    });

    historyMapLayer = L.layerGroup();
    segments.forEach(seg => {
      const color = seg.type === 'warmup' ? warmupColor : seg.type === 'jog' ? jogColor : walkColor;
      L.polyline(seg.points, { color, weight: 4, opacity: 0.9 }).addTo(historyMapLayer);
    });
    historyMapLayer.addTo(historyMap);

    const allPoints = entry.track.map(p => [p.lat, p.lng]);
    const bounds = L.latLngBounds(allPoints);
    historyMap.fitBounds(bounds, { padding: [20, 20] });

    const rows = [
      { label: 'Warmup walk', stats: stats.byType.warmup },
      { label: 'Jog', stats: stats.byType.jog },
      { label: 'Walk', stats: stats.byType.walk },
      { label: 'Total', stats: { distance: stats.totalDistance, time: stats.totalTime } },
    ];
    rows.forEach(r => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `
        <span class="stat-label">${r.label}</span>
        <span>${formatDistance(r.stats.distance)} • ${fmtDuration(r.stats.time)}</span>
      `;
      mapStats.appendChild(row);
    });
  }

  // ─── EVENT WIRING ─────────────────────────────────────────
  function init() {
    data = getData();
    initSetup();

    if (!data.gpsPermissionAsked) {
      data.gpsPermissionAsked = true;
      saveData(data);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => {},
          () => {},
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      }
    }

    $('#start-btn').addEventListener('click', () => {
      const idx = getRecommendedIndex(data);
      if (idx < PLAN.length) startWorkout(idx);
    });
    $('#history-btn').addEventListener('click', showHistory);
    $('#settings-btn').addEventListener('click', () => {
      selectedDays = new Set(data.workoutDays || []);
      $$('.day-btn').forEach(b => {
        const day = Number(b.dataset.day);
        if (selectedDays.has(day)) b.classList.add('selected');
        else b.classList.remove('selected');
      });
      $('#setup-done-btn').disabled = selectedDays.size !== 3;
      $('#day-hint').textContent = selectedDays.size === 3 ? 'Great choices!' : `Select ${3 - selectedDays.size} more`;
      $('#race-date-input').value = data.raceDate || '';
      $('#setup-back-btn').hidden = false;
      showScreen('#setup-screen');
    });

    $('#ctrl-start-stop').addEventListener('click', () => {
      if (isRunning) stopTimer(); else startTimer();
    });
    $('#ctrl-restart').addEventListener('click', restartWorkout);
    $('#workout-back-btn').addEventListener('click', () => {
      stopTimer();
      clearWorkoutState();
      activeWorkout = null;
      activeWorkoutIdx = null;
      showHome();
    });

    $$('.rating-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedRating = Number(btn.dataset.rating);
        $$('.rating-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        $('#complete-done-btn').disabled = false;
      });
    });
    $('#complete-done-btn').addEventListener('click', saveCompleted);

    $('#history-back-btn').addEventListener('click', showHome);

    $('#history-map-close').addEventListener('click', () => {
      $('#history-map').hidden = true;
    });

    const overviewEl = $('#program-overview');
    if (overviewEl) {
      overviewEl.addEventListener('toggle', () => {
        data.programOverviewOpen = overviewEl.open;
        saveData(data);
      });
    }

    $('#setup-back-btn').addEventListener('click', () => {
      showHome();
    });

    $('#reset-recommend-btn').addEventListener('click', () => {
      data.overrideWorkoutIdx = null;
      saveData(data);
      showHome();
    });

    $('#history-clear-btn').addEventListener('click', () => {
      if (confirm('Delete all workout history? This will reset your progress.')) {
        data.history = [];
        recalcCurrentWorkout();
        if (historyMapLayer && historyMap) {
          historyMap.removeLayer(historyMapLayer);
          historyMapLayer = null;
        }
        $('#history-map').hidden = true;
        showHistory();
      }
    });

    if (!restoreWorkoutState()) {
      showHome();
    }
  }

  // ─── Wake lock ─────────────────────────────────────────────
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
    setInterval(() => {
      if (isRunning && !wakeLock) requestWakeLock();
      if (!isRunning && wakeLock) releaseWakeLock();
    }, 2000);
  });
})();
