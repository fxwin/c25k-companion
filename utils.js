/* ===== C25K Companion — utils.js ===== */
/* Helpers, audio, vibration, localStorage, text formatters */
(function () {
  'use strict';

  const ns = window.C25K = window.C25K || {};

  // ─── DOM helpers ───────────────────────────────────────────
  ns.$ = function (sel) { return document.querySelector(sel); };
  ns.$$ = function (sel) { return document.querySelectorAll(sel); };

  // ─── Time / duration formatting ────────────────────────────
  ns.fmtTime = function (sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  ns.fmtDuration = function (sec) {
    if (sec >= 3600) {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      return `${h}h ${m}m`;
    }
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  ns.totalDuration = function (segments) {
    return segments.reduce((a, s) => a + s.duration, 0);
  };

  ns.distanceMeters = function (a, b) {
    const R = 6371000;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  ns.formatDistance = function (meters) {
    return `${Math.round(meters)} m`;
  };

  ns.formatDurationShort = function (sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m > 0 && s > 0) return `${m}min ${s}s`;
    if (m > 0) return `${m}min`;
    return `${s}s`;
  };

  ns.formatPace = function (secPerKm) {
    if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '—';
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  ns.workoutLabel = function (w) {
    return `Week ${w.week} · Day ${w.day}`;
  };

  ns.workoutDescription = function (w) {
    const parts = w.segments.map(s => {
      const d = ns.fmtDuration(s.duration);
      if (s.type === 'warmup') return `${d} warmup walk`;
      if (s.type === 'jog') return `${d} jog`;
      return `${d} walk`;
    });
    return parts.join(' → ');
  };

  // ─── Audio beep (Web Audio API — won't pause music) ────────
  let audioCtx = null;
  ns.getAudioCtx = function () {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  };

  ns.beep = function (freq, ms) {
    try {
      const ctx = ns.getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.18;
      osc.start();
      osc.stop(ctx.currentTime + ms / 1000);
    } catch (_) { /* silent fail */ }
  };

  ns.beepTransition = function () {
    ns.beep(880, 150);
    setTimeout(() => ns.beep(880, 150), 200);
  };

  ns.beepDone = function () {
    ns.beep(1047, 150);
    setTimeout(() => ns.beep(1319, 150), 180);
    setTimeout(() => ns.beep(1568, 300), 360);
  };

  // ─── Vibration helper ──────────────────────────────────────
  ns.vibrate = function (pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  };

  // ─── LocalStorage ──────────────────────────────────────────
  const STORAGE_KEY = 'c25k_data';

  ns.loadData = function () {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  };

  ns.saveData = function (d) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  };

  ns.getData = function () {
    const d = ns.loadData();
    if (!d.workoutDays) d.workoutDays = null;
    if (!d.currentWorkout) d.currentWorkout = 0;
    if (!d.history) d.history = [];
    if (d.raceDate === undefined) d.raceDate = null;
    if (d.overrideWorkoutIdx === undefined) d.overrideWorkoutIdx = null;
    if (d.programOverviewOpen === undefined) d.programOverviewOpen = false;
    if (d.activeWorkoutState === undefined) d.activeWorkoutState = null;
    if (d.gpsPermissionAsked === undefined) d.gpsPermissionAsked = false;
    if (d.hasDummyHistory === undefined) d.hasDummyHistory = false;
    return d;
  };

  // ─── Race countdown ────────────────────────────────────────
  ns.raceCountdownText = function (data) {
    if (!data.raceDate) return null;
    const raceDate = new Date(data.raceDate + 'T00:00:00');
    const now = new Date();
    const diff = raceDate - now;
    if (diff <= 0) return 'Race day!';
    const days = Math.ceil(diff / 86400000);
    return `${days} day${days === 1 ? '' : 's'} to race`;
  };

  // ─── Next workout day text ─────────────────────────────────
  ns.nextWorkoutText = function (workoutDays) {
    if (!workoutDays || workoutDays.length === 0) return '';
    const now = new Date();
    const today = now.getDay();
    const sorted = [...workoutDays].sort((a, b) => a - b);
    let minDist = 8;
    for (const wd of sorted) {
      let dist = (wd - today + 7) % 7;
      if (dist < minDist) minDist = dist;
    }
    if (minDist === 0) return '📅 Next workout: Today!';
    if (minDist === 1) return '📅 Next workout: Tomorrow';
    return `📅 Next workout: in ${minDist} days`;
  };

  // ─── Override helpers ──────────────────────────────────────
  ns.hasOverride = function (data) {
    return data.overrideWorkoutIdx !== null && data.overrideWorkoutIdx !== undefined;
  };

  ns.getRecommendedIndex = function (data) {
    return ns.hasOverride(data) ? data.overrideWorkoutIdx : data.currentWorkout;
  };
})();
