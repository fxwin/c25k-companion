/* ===== C25K Companion — app.js ===== */
/* App state, screen controllers, event wiring */
(function () {
  'use strict';

  const ns = window.C25K;
  const PLAN = ns.PLAN;
  const { $, $$, fmtTime, formatDurationShort, formatPace, totalDuration, workoutLabel,
          saveData, getData, hasOverride, getRecommendedIndex, getDevMode, setDevMode,
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
  const START_BUFFER_SECS = 5;
  let preStartCountdown = 0;
  let preStartAnnounced = false;
  let selectedDays = new Set();
  let suppressTransitionAlert = false;
  let watchId = null;
  let track = [];
  const historyMaps = new WeakMap();
  const statsCharts = {};
  const audioCache = {};

  function persistWorkoutState(status) {
    if (activeWorkoutIdx === null) return;
    data.activeWorkoutState = {
      status: status || 'in-progress',
      workoutIdx: activeWorkoutIdx,
      segIdx,
      segElapsed,
      totalElapsed,
      transitionCountdown,
      preStartCountdown,
      preStartAnnounced,
      isRunning,
      lastTs: Date.now(),
    };
    saveData(data);
  }

  function clearWorkoutState() {
    data.activeWorkoutState = null;
    saveData(data);
  }

  function getVoiceKeyForReady(nextSeg, workoutWeek) {
    if (!nextSeg) return null;
    const dur = nextSeg.duration;
    const base = `get_ready_${nextSeg.type}_${dur}`;
    if (nextSeg.type === 'jog' && workoutWeek >= 7) return `${base}_nowalk`;
    return base;
  }

  function playVoice(key) {
    if (!key || data.audioMuted || data.audioMode === 'mute' || data.audioMode === 'beeps') return;
    const path = `audio/${data.audioMode}/${key}.mp3`;
    let audio = audioCache[path];
    if (!audio) {
      audio = new Audio(path);
      audioCache[path] = audio;
    }
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function currentSegmentType() {
    if (!activeWorkout) return 'walk';
    if (transitionCountdown > 0) {
      const prevIdx = Math.max(0, segIdx - 1);
      const prevSeg = activeWorkout.segments[prevIdx];
      return prevSeg ? prevSeg.type : 'walk';
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
    preStartCountdown = state.preStartCountdown || 0;
    preStartAnnounced = !!state.preStartAnnounced;
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
    const audioSelect = $('#audio-mode');
    if (audioSelect) {
      audioSelect.value = data.audioMode || 'beeps';
      audioSelect.addEventListener('change', () => {
        data.audioMode = audioSelect.value;
        data.audioModeSet = true;
        data.audioMuted = data.audioMode === 'mute';
        saveData(data);
      });
    }
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
      if (audioSelect) {
        data.audioMode = audioSelect.value;
        data.audioModeSet = true;
        data.audioMuted = data.audioMode === 'mute';
      }
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

    const recentPaceEl = $('#recent-jog-pace');
    const latest = data.history[data.history.length - 1];
    const jogStats = latest && latest.trackStats ? latest.trackStats.byType.jog : null;
    if (jogStats && jogStats.distance > 0) {
      const pace = formatPace(jogStats.time / (jogStats.distance / 1000));
      recentPaceEl.textContent = `Current pace: ${pace}/km`;
      recentPaceEl.hidden = false;
    } else if (recentPaceEl) {
      recentPaceEl.hidden = true;
    }

    const overrideActive = hasOverride(data);
    let idx = getRecommendedIndex(data);
    if (!getDevMode() && PLAN[idx] && PLAN[idx].week === 0) {
      idx = 1;
    }
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
    $('#workout-total-time').textContent = `Total: ${formatDurationShort(totalDuration(w.segments))}`;

    // Build program overview
    buildProgramOverview(data, { onSetNext: showHome });
    const overviewEl = $('#program-overview');
    if (overviewEl) overviewEl.open = !!data.programOverviewOpen;
  }

  // ─── WORKOUT SCREEN ───────────────────────────────────────
  function startWorkout(idx) {
    if (!getDevMode() && PLAN[idx] && PLAN[idx].week === 0) {
      idx = 1;
    }
    activeWorkoutIdx = idx;
    activeWorkout = PLAN[idx];
    segIdx = 0;
    segElapsed = 0;
    totalElapsed = 0;
    isRunning = false;
    transitionCountdown = 0;
    preStartCountdown = START_BUFFER_SECS;
    preStartAnnounced = false;
    track = [];

    showScreen('#workout-screen');
    $('#active-workout-title').textContent = workoutLabel(activeWorkout);
    renderWorkoutState();
    updateControls();
    persistWorkoutState('in-progress');
    syncWorkoutAudioControls();
  }

  function renderWorkoutState() {
    if (preStartCountdown > 0) {
      const firstSeg = activeWorkout.segments[0];
      const typeEl = $('#segment-type');
      const firstLabel = firstSeg.type === 'warmup' ? 'Warmup Walk' : firstSeg.type === 'jog' ? 'Jog' : 'Walk';
      typeEl.textContent = `Get Ready: ${firstLabel}`;
      typeEl.className = 'segment-type type-transition';
      $('#segment-timer').textContent = fmtTime(preStartCountdown);
      $('#segment-remaining').textContent = `Segment 1 of ${activeWorkout.segments.length}`;

      const total = totalDuration(activeWorkout.segments);
      const pct = Math.min(100, (totalElapsed / total) * 100);
      $('#total-progress-bar').style.width = pct + '%';
      $('#total-time-display').textContent = `${fmtTime(totalElapsed)} / ${fmtTime(total)}`;

      buildActiveTimeline($('#active-timeline'), activeWorkout.segments, 0);
      return;
    }
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
    if (preStartCountdown > 0) {
      preStartCountdown--;
      if (preStartCountdown === 0) {
        if (data.audioMode === 'beeps' && !data.audioMuted) {
          beepTransition();
        } else {
          playVoice('start_now');
        }
        vibrate([200, 100, 200]);
      }
      renderWorkoutState();
      if (isRunning) persistWorkoutState('in-progress');
      return;
    }
    if (transitionCountdown > 0) {
      transitionCountdown--;
      if (transitionCountdown === 0) {
        if (suppressTransitionAlert) {
          suppressTransitionAlert = false;
        } else {
          if (data.audioMode === 'beeps' && !data.audioMuted) {
            beepTransition();
          } else {
            playVoice('start_now');
          }
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
        if (data.audioMode === 'beeps' && !data.audioMuted) {
          beepDone();
        } else {
          playVoice('workout_done');
        }
        vibrate([200, 100, 200, 100, 400]);
        showComplete();
        persistWorkoutState('complete');
        return;
      }
      transitionCountdown = TRANSITION_SECS;
      if (data.audioMode === 'beeps' && !data.audioMuted) {
        beep(660, 200);
      } else {
        const nextSeg = activeWorkout.segments[segIdx];
        playVoice(getVoiceKeyForReady(nextSeg, activeWorkout.week));
      }
    }
    renderWorkoutState();
    if (isRunning) persistWorkoutState('in-progress');
  }

  function playAudioSample(mode) {
    if (data.audioMuted) return;
    if (mode === 'beeps') {
      beepDone();
    } else if (mode === 'female' || mode === 'male') {
      playVoice('sample_start');
    }
  }

  function syncWorkoutAudioControls() {
    const audioSelect = $('#workout-audio-mode');
    const muteBtn = $('#audio-mute-btn');
    const muteIcon = $('#audio-mute-icon');
    if (audioSelect) audioSelect.value = data.audioMode || 'beeps';
    if (muteBtn) {
      muteBtn.classList.toggle('muted', !!data.audioMuted);
      muteBtn.setAttribute('aria-pressed', data.audioMuted ? 'true' : 'false');
      if (muteIcon) {
        muteIcon.src = data.audioMuted ? 'icons/speaker_mute.svg' : 'icons/speaker.svg';
        muteIcon.alt = data.audioMuted ? 'Muted' : 'Speaker';
      }
    }
  }

  function startTimer() {
    if (timerInterval) return;
    const ctx = ns.getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    isRunning = true;
    if (totalElapsed === 0 && segIdx === 0 && segElapsed === 0 && transitionCountdown === 0) {
      if (preStartCountdown === 0) preStartCountdown = START_BUFFER_SECS;
      if (!preStartAnnounced) {
        playVoice('get_ready_warmup_300');
        preStartAnnounced = true;
      }
    }
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
    preStartCountdown = 0;
    preStartAnnounced = false;
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
    $('#complete-duration').textContent = `Duration: ${formatDurationShort(totalElapsed)}`;
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

      const entry = document.createElement('div');
      entry.className = 'history-entry';

      const item = document.createElement('div');
      item.className = 'history-item-header';
      item.innerHTML = `
        <div class="hi-left">
          <div class="hi-name">${h.label}</div>
          <div class="hi-date">${dateStr} · ${timeStr}</div>
        </div>
        <div class="hi-right">
          <div class="hi-duration">${formatDurationShort(h.duration)}</div>
          <div class="hi-distance">${dist}</div>
        </div>
        <div class="hi-actions">
          <div class="hi-rating">${ratingEmojis[h.rating] || ''}</div>
          <button class="hi-delete" data-idx="${realIdx}" title="Delete">✕</button>
        </div>
      `;

      const mapWrap = document.createElement('div');
      mapWrap.className = 'history-map-inline';
      mapWrap.hidden = true;
      mapWrap.innerHTML = `
        <div class="history-map-canvas"></div>
        <div class="history-map-stats"></div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.hi-delete')) return;
        const isHidden = mapWrap.hidden;
        // close other maps
        list.querySelectorAll('.history-map-inline').forEach(m => m.hidden = true);
        if (isHidden) {
          mapWrap.hidden = false;
          const canvas = mapWrap.querySelector('.history-map-canvas');
          const stats = mapWrap.querySelector('.history-map-stats');
          renderHistoryMap(h, canvas, stats, mapWrap);
        } else {
          mapWrap.hidden = true;
        }
      });

      entry.appendChild(item);
      entry.appendChild(mapWrap);
      list.appendChild(entry);
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

  function getJogPaceSeconds(entry) {
    if (!entry || !entry.trackStats) return null;
    const jog = entry.trackStats.byType.jog;
    if (!jog || jog.distance <= 0) return null;
    return jog.time / (jog.distance / 1000);
  }

  function destroyChart(key) {
    if (statsCharts[key]) {
      statsCharts[key].destroy();
      statsCharts[key] = null;
    }
  }

  function setChartEmpty(canvas, message) {
    const parent = canvas.parentElement;
    canvas.hidden = true;
    let hint = parent.querySelector('.chart-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'hint chart-hint';
      parent.appendChild(hint);
    }
    hint.textContent = message || 'No data';
  }

  function clearChartEmpty(canvas) {
    const parent = canvas.parentElement;
    const hint = parent.querySelector('.chart-hint');
    if (hint) hint.remove();
    canvas.hidden = false;
  }

  function renderLineChart(canvas, values, color, yTickFormatter, opts) {
    if (!values || values.length === 0) {
      destroyChart(canvas.id);
      setChartEmpty(canvas, 'No data');
      return;
    }
    clearChartEmpty(canvas);
    destroyChart(canvas.id);
    const labels = values.map((_, i) => i + 1);
    const yAxisWidth = (opts && opts.yAxisWidth) || 46;
    statsCharts[canvas.id] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: color,
          backgroundColor: 'transparent',
          pointRadius: 2,
          pointHoverRadius: 3,
          tension: 0.3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { callback: () => '' },
            grid: { display: false },
            border: { display: false }
          },
          y: {
            ticks: { callback: yTickFormatter, maxTicksLimit: 5, ...(opts && opts.yTicks || {}) },
            grid: (opts && opts.yGrid) || { color: '#EEEEEE' },
            border: { display: false },
            afterFit: scale => { scale.width = yAxisWidth; },
            ...(opts && opts.yScale || {})
          }
        }
      }
    });
  }

  function renderBarChart(canvas, labels, counts, color) {
    destroyChart(canvas.id);
    clearChartEmpty(canvas);
    statsCharts[canvas.id] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: color,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 12 } }, grid: { display: false }, border: { display: false } },
          y: { ticks: { precision: 0, maxTicksLimit: 5 }, grid: { color: '#EEEEEE' }, border: { display: false }, afterFit: scale => { scale.width = 46; } }
        }
      }
    });
  }

  let statsShowAll = false;

  function showStats() {
    showScreen('#stats-screen');
    renderStats();
  }

  function renderStats() {
    const summary = $('#stats-summary');
    const distanceChart = $('#stats-distance-chart');
    const paceChart = $('#stats-pace-chart');
    const moodChart = $('#stats-mood-chart');
    const moodDist = $('#stats-mood-dist');
    const toggleEl = $('#stats-toggle');
    if (statsShowAll) toggleEl.classList.add('on');
    else toggleEl.classList.remove('on');
    toggleEl.querySelectorAll('.stats-switch-label').forEach(l => {
      l.classList.toggle('active', (l.dataset.val === 'all') === statsShowAll);
    });
    const rangeLabel = statsShowAll ? 'all' : 'last 10';
    $('#stats-distance-title').textContent = `Distance (${rangeLabel})`;
    $('#stats-pace-title').textContent = `Jog Pace (${rangeLabel})`;
    $('#stats-mood-title').textContent = `Mood (${rangeLabel})`;

    const history = statsShowAll ? [...data.history] : [...data.history].slice(-10);
    if (history.length === 0) {
      summary.innerHTML = '<div class="hint">No workouts yet.</div>';
      destroyChart('stats-distance-chart');
      destroyChart('stats-pace-chart');
      destroyChart('stats-mood-chart');
      destroyChart('stats-mood-dist');
      setChartEmpty(distanceChart, 'No data');
      setChartEmpty(paceChart, 'No data');
      setChartEmpty(moodChart, 'No data');
      setChartEmpty(moodDist, 'No data');
      return;
    }

    const distances = history.map(h => h.trackStats ? h.trackStats.totalDistance : 0);
    const jogPaces = history.map(h => getJogPaceSeconds(h)).filter(v => v !== null);
    const moods = history.map(h => h.rating || 0);
    const totalDistance = distances.reduce((a, b) => a + b, 0);
    const totalTime = history.reduce((a, h) => a + (h.trackStats ? h.trackStats.totalTime : 0), 0);
    const avgMood = moods.reduce((a, b) => a + b, 0) / moods.length;
    const avgPace = totalDistance > 0 ? formatPace(totalTime / (totalDistance / 1000)) : '—';
    const avgJogPace = jogPaces.length > 0 ? formatPace(jogPaces.reduce((a, b) => a + b, 0) / jogPaces.length) : '—';

    summary.innerHTML = `
      <div class="stats-card stats-metric">
        <div class="value">${formatDistance(totalDistance)}</div>
        <div class="label">Total distance</div>
      </div>
      <div class="stats-card stats-metric">
        <div class="value">${avgPace}/km</div>
        <div class="label">Avg pace</div>
      </div>
      <div class="stats-card stats-metric">
        <div class="value">${avgJogPace}/km</div>
        <div class="label">Avg jog pace</div>
      </div>
      <div class="stats-card stats-metric">
        <div class="value">${avgMood.toFixed(1)}</div>
        <div class="label">Avg mood</div>
      </div>
    `;

    renderLineChart(distanceChart, distances, '#2E7D32', v => formatDistance(v), { yAxisWidth: 64 });
    if (jogPaces.length > 0) {
      renderLineChart(paceChart, jogPaces, '#1E88E5', v => formatPace(v) + '/km', { yAxisWidth: 64 });
    } else {
      destroyChart('stats-pace-chart');
      setChartEmpty(paceChart, 'No jog data');
    }
    const moodEmojis = ['', '😫', '😕', '😐', '🙂', '😄'];
    renderLineChart(moodChart, moods.map(m => m || 0), '#FB8C00', v => {
      const i = Math.round(v);
      return moodEmojis[i] || '';
    }, {
      yAxisWidth: 28,
      yTicks: { stepSize: 1 },
      yScale: { min: 1, max: 5 },
      yGrid: {
        color: ctx => ctx.tick.value === 3 ? '#999999' : '#EEEEEE',
        lineWidth: ctx => ctx.tick.value === 3 ? 2 : 1
      }
    });

    const moodCounts = [1, 2, 3, 4, 5].map(v => moods.filter(m => m === v).length);
    renderBarChart(moodDist, ['😫', '😕', '😐', '🙂', '😄'], moodCounts, '#43A047');
  }

  function renderHistoryMap(entry, mapCanvas, mapStats, mapWrap) {
    mapStats.innerHTML = '';

    const stats = entry.trackStats;
    if (!entry.track || entry.track.length < 2 || !stats) {
      mapCanvas.innerHTML = '<div class="hint">No GPS data available for this workout.</div>';
      return;
    }

    const warmupColor = '#FB8C00';
    const jogColor = '#2E7D32';
    const walkColor = '#1E88E5';

    // Build segment groups with per-segment stats
    const segments = [];
    let current = [];
    let currentType = entry.track[0].type;
    let segDistance = 0;
    let segTime = 0;
    for (let i = 1; i < entry.track.length; i++) {
      const prev = entry.track[i - 1];
      const p = entry.track[i];
      if (p.type !== currentType) {
        if (current.length > 1) {
          segments.push({ type: currentType, points: current, distance: segDistance, time: segTime });
        }
        currentType = p.type;
        current = [];
        segDistance = 0;
        segTime = 0;
      }
      if (current.length === 0) current.push([prev.lat, prev.lng]);
      current.push([p.lat, p.lng]);
      segDistance += distanceMeters(prev, p);
      segTime += Math.max(0, Math.floor((p.ts - prev.ts) / 1000));
      if (i === entry.track.length - 1 && current.length > 1) {
        segments.push({ type: currentType, points: current, distance: segDistance, time: segTime });
      }
    }

    // Build or reuse map
    let map = historyMaps.get(mapWrap);
    if (!map) {
      mapCanvas.innerHTML = '';
      map = L.map(mapCanvas);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      historyMaps.set(mapWrap, map);
    } else {
      map.invalidateSize();
    }

    if (map._c25kLayer) {
      map.removeLayer(map._c25kLayer);
    }

    const layer = L.layerGroup();
    segments.forEach(seg => {
      const color = seg.type === 'warmup' ? warmupColor : seg.type === 'jog' ? jogColor : walkColor;
      const poly = L.polyline(seg.points, { color, weight: 4, opacity: 0.9 }).addTo(layer);
      const midIdx = Math.floor(seg.points.length / 2);
      const mid = seg.points[midIdx];
      const label = `
        <div class="segment-label-line">${formatDistance(seg.distance)}</div>
        <div class="segment-label-line">${formatDurationShort(seg.time)}</div>
      `;
      const icon = L.divIcon({ className: 'segment-label', html: label, iconSize: [76, 34] });
      L.marker(mid, { icon }).addTo(layer);
    });
    layer.addTo(map);
    map._c25kLayer = layer;

    const allPoints = entry.track.map(p => [p.lat, p.lng]);
    const bounds = L.latLngBounds(allPoints);
    map.fitBounds(bounds, { padding: [20, 20] });

    const rows = [
      { label: 'Warmup walk', stats: stats.byType.warmup },
      { label: 'Jog', stats: stats.byType.jog },
      { label: 'Walk', stats: stats.byType.walk },
      { label: 'Total', stats: { distance: stats.totalDistance, time: stats.totalTime } },
    ];
    rows.forEach(r => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      const pace = r.stats.distance > 0
        ? formatPace(r.stats.time / (r.stats.distance / 1000)) + '/km'
        : '—';
      const swatch = r.label === 'Warmup walk' ? 'seg-warmup' : r.label === 'Jog' ? 'seg-jog' : r.label === 'Walk' ? 'seg-walk' : '';
      row.innerHTML = `
        <span class="stat-label"><span class="stat-swatch ${swatch}"></span>${r.label}</span>
        <span>${formatDistance(r.stats.distance)} • ${formatDurationShort(r.stats.time)} • ${pace}</span>
      `;
      mapStats.appendChild(row);
      if (r.label === 'Walk') {
        const divider = document.createElement('div');
        divider.className = 'stat-divider';
        mapStats.appendChild(divider);
      }
    });
  }

  // ─── EVENT WIRING ─────────────────────────────────────────
  function seedSampleHistory() {
    if (!getDevMode()) return;
    if (!data.hasDummyHistory && data.history.length === 0) {
      const now = Date.now();
      const samples = [
        {
          label: 'Sample Workout A',
          baseTs: now - 86400000,
          track: [
            { lat: 37.7749, lng: -122.4194, ts: 0, type: 'warmup' },
            { lat: 37.7756, lng: -122.4187, ts: 2, type: 'warmup' },
            { lat: 37.7762, lng: -122.4180, ts: 4, type: 'jog' },
            { lat: 37.7768, lng: -122.4172, ts: 6, type: 'jog' },
            { lat: 37.7773, lng: -122.4164, ts: 8, type: 'walk' },
            { lat: 37.7778, lng: -122.4156, ts: 10, type: 'walk' },

          ]
        },
        {
          label: 'Sample Workout B',
          baseTs: now - 2 * 86400000,
          track: [
            { lat: 37.7712, lng: -122.4231, ts: 0, type: 'warmup' },
            { lat: 37.7719, lng: -122.4222, ts: 3, type: 'warmup' },
            { lat: 37.7725, lng: -122.4213, ts: 6, type: 'jog' },
            { lat: 37.7731, lng: -122.4204, ts: 9, type: 'jog' },
            { lat: 37.7736, lng: -122.4196, ts: 12, type: 'walk' },
            { lat: 37.7741, lng: -122.4188, ts: 15, type: 'walk' },
          ]
        },
        {
          label: 'Sample Workout C',
          baseTs: now - 3 * 86400000,
          track: [
            { lat: 37.7791, lng: -122.4147, ts: 0, type: 'warmup' },
            { lat: 37.7796, lng: -122.4139, ts: 2, type: 'warmup' },
            { lat: 37.7802, lng: -122.4130, ts: 4, type: 'jog' },
            { lat: 37.7807, lng: -122.4121, ts: 6, type: 'jog' },
            { lat: 37.7812, lng: -122.4112, ts: 8, type: 'walk' },
            { lat: 37.7816, lng: -122.4104, ts: 10, type: 'walk' },
          ]
        },
        {
          label: 'Sample Workout D',
          baseTs: now - 4 * 86400000,
          track: [
            { lat: 37.7684, lng: -122.4262, ts: 0, type: 'warmup' },
            { lat: 37.7690, lng: -122.4254, ts: 3, type: 'warmup' },
            { lat: 37.7696, lng: -122.4246, ts: 6, type: 'jog' },
            { lat: 37.7701, lng: -122.4238, ts: 9, type: 'jog' },
            { lat: 37.7706, lng: -122.4230, ts: 12, type: 'walk' },
            { lat: 37.7711, lng: -122.4222, ts: 15, type: 'walk' },
          ]
        },
        {
          label: 'Sample Workout E',
          baseTs: now - 5 * 86400000,
          track: [
            { lat: 37.7820, lng: -122.4095, ts: 0, type: 'warmup' },
            { lat: 37.7826, lng: -122.4087, ts: 2, type: 'warmup' },
            { lat: 37.7832, lng: -122.4079, ts: 4, type: 'jog' },
            { lat: 37.7837, lng: -122.4071, ts: 6, type: 'jog' },
            { lat: 37.7842, lng: -122.4063, ts: 8, type: 'walk' },
            { lat: 37.7847, lng: -122.4055, ts: 10, type: 'walk' },
          ]
        },
        {
          label: 'Sample Workout F',
          baseTs: now - 6 * 86400000,
          track: [
            { lat: 37.7652, lng: -122.4310, ts: 0, type: 'warmup' },
            { lat: 37.7658, lng: -122.4302, ts: 3, type: 'warmup' },
            { lat: 37.7663, lng: -122.4294, ts: 6, type: 'jog' },
            { lat: 37.7669, lng: -122.4286, ts: 9, type: 'jog' },
            { lat: 37.7674, lng: -122.4278, ts: 12, type: 'walk' },
            { lat: 37.7680, lng: -122.4270, ts: 15, type: 'walk' },
          ]
        },
        {
          label: 'Sample Workout G',
          baseTs: now - 7 * 86400000,
          track: [
            { lat: 37.7871, lng: -122.4018, ts: 0, type: 'warmup' },
            { lat: 37.7877, lng: -122.4010, ts: 2, type: 'warmup' },
            { lat: 37.7883, lng: -122.4002, ts: 4, type: 'jog' },
            { lat: 37.7889, lng: -122.3994, ts: 6, type: 'jog' },
            { lat: 37.7894, lng: -122.3986, ts: 8, type: 'walk' },
            { lat: 37.7900, lng: -122.3978, ts: 10, type: 'walk' },
          ]
        },
        {
          label: 'Sample Workout H',
          baseTs: now - 8 * 86400000,
          track: [
            { lat: 37.7760, lng: -122.4310, ts: 0, type: 'warmup' },
            { lat: 37.7764, lng: -122.4306, ts: 1, type: 'warmup' },
            { lat: 37.7768, lng: -122.4302, ts: 2, type: 'warmup' },
            { lat: 37.7772, lng: -122.4298, ts: 3, type: 'jog' },
            { lat: 37.7776, lng: -122.4294, ts: 4, type: 'jog' },
            { lat: 37.7780, lng: -122.4290, ts: 5, type: 'jog' },
            { lat: 37.7784, lng: -122.4286, ts: 6, type: 'walk' },
            { lat: 37.7788, lng: -122.4282, ts: 7, type: 'walk' },
            { lat: 37.7792, lng: -122.4278, ts: 8, type: 'walk' },
            { lat: 37.7796, lng: -122.4274, ts: 9, type: 'jog' },
            { lat: 37.7800, lng: -122.4270, ts: 10, type: 'jog' },
            { lat: 37.7804, lng: -122.4266, ts: 11, type: 'jog' },
            { lat: 37.7808, lng: -122.4262, ts: 12, type: 'walk' },
            { lat: 37.7812, lng: -122.4258, ts: 13, type: 'walk' },
            { lat: 37.7816, lng: -122.4254, ts: 14, type: 'walk' },
            { lat: 37.7820, lng: -122.4250, ts: 15, type: 'jog' },
            { lat: 37.7824, lng: -122.4246, ts: 16, type: 'jog' },
            { lat: 37.7828, lng: -122.4242, ts: 17, type: 'jog' },
            { lat: 37.7832, lng: -122.4238, ts: 18, type: 'walk' },
            { lat: 37.7836, lng: -122.4234, ts: 19, type: 'walk' },
            { lat: 37.7840, lng: -122.4230, ts: 20, type: 'walk' }
          ]
        }
      ];

      const ratings = [3, 5, 4, 2, 4, 1, 5, 3];
      samples.forEach((s, i) => {
        const track = s.track.map(p => ({
          lat: p.lat,
          lng: p.lng,
          ts: s.baseTs + p.ts * 60000,
          type: p.type,
        }));
        const stats = computeTrackStats(track);
        data.history.push({
          workoutIdx: i,
          label: s.label,
          date: new Date(s.baseTs).toISOString(),
          duration: stats.totalTime,
          rating: ratings[i % ratings.length],
          track,
          trackStats: stats,
        });
      });

      data.hasDummyHistory = true;
      saveData(data);
    }
  }

  function applyDevDefaults() {
    if (!getDevMode()) return;
    data.workoutDays = [2, 4, 6];
    data.raceDate = '2026-12-25';
    data.audioMode = 'male';
    data.audioModeSet = true;
    data.audioMuted = false;
    saveData(data);
  }

  function init() {
    data = getData();
    if (!data.audioModeSet) {
      data.audioMode = 'beeps';
      data.audioMuted = true;
      saveData(data);
    } else if (data.audioMode !== 'mute') {
      data.audioMuted = false;
      saveData(data);
    }
    if (!getDevMode()) {
      if (data.currentWorkout === 0) {
        data.currentWorkout = 1;
      }
      if (data.overrideWorkoutIdx === 0) {
        data.overrideWorkoutIdx = null;
      }
      saveData(data);
    }
    if (!getDevMode() && data.history.length > 0) {
      data.history = data.history.filter(h => !(h.label || '').startsWith('Sample Workout'));
      data.hasDummyHistory = false;
      saveData(data);
    }
    applyDevDefaults();
    seedSampleHistory();
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

    const devToggle = $('#dev-mode-toggle');
    if (devToggle) {
      devToggle.checked = getDevMode();
      devToggle.addEventListener('change', () => {
        stopTimer();
        clearWorkoutState();
        activeWorkout = null;
        activeWorkoutIdx = null;
        track = [];
        setDevMode(devToggle.checked);
        data = getData();
        applyDevDefaults();
        seedSampleHistory();
        showHome();
      });
    }

    $('#start-btn').addEventListener('click', () => {
      const idx = getRecommendedIndex(data);
      if (idx < PLAN.length) startWorkout(idx);
    });
    $('#history-btn').addEventListener('click', showHistory);
    $('#stats-btn').addEventListener('click', showStats);
    $('#stats-toggle').addEventListener('click', () => {
      statsShowAll = !statsShowAll;
      renderStats();
    });
    const workoutAudioSelect = $('#workout-audio-mode');
    const workoutMuteBtn = $('#audio-mute-btn');
    if (workoutAudioSelect) {
      workoutAudioSelect.value = data.audioMode || 'beeps';
      workoutAudioSelect.addEventListener('change', () => {
        data.audioMode = workoutAudioSelect.value;
        data.audioMuted = data.audioMode === 'mute';
        saveData(data);
        syncWorkoutAudioControls();
        playAudioSample(data.audioMode);
      });
    }
    if (workoutMuteBtn) {
      workoutMuteBtn.addEventListener('click', () => {
        data.audioMuted = !data.audioMuted;
        saveData(data);
        syncWorkoutAudioControls();
        if (!data.audioMuted) playAudioSample(data.audioMode);
      });
    }
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
    $('#stats-back-btn').addEventListener('click', showHome);


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
